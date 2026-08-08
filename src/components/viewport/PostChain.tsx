import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, EffectPass, Pass, RenderPass, type Effect } from 'postprocessing'
import { HalfFloatType, Vector2 } from 'three'
import { PostRegistry } from '@/engine/post/PostRegistry'
import type { PostContext, PostHandle } from '@/engine/post/types'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { activeClock } from '@/engine/time/timeAuthority'
import { usePostStore } from '@/store/usePostStore'
import { POST_STACK_ID } from '@/types/visual'
import type { ParamValue } from '@/types/params'

/** The post-processing chain (docs/10-ELEMENTS.md §H).
 *
 *  Mounted only while something is actually enabled. That is not an optimisation — it is
 *  how rendering is handed back and forth: a `useFrame` with priority ≥ 1 takes the
 *  render loop away from R3F, so unmounting is what returns it. With an empty stack the
 *  frame goes straight to the screen exactly as before, with no render target in the path.
 *
 *  Render targets follow the renderer's **drawing buffer**, not R3F's `size` — those two
 *  disagree during an offline export, and following the wrong one silently rendered the
 *  whole chain at preview resolution and upscaled it into the file.
 *
 *  Parameters are written imperatively every frame, never through props (HC-1). The chain is
 *  rebuilt only when its SHAPE changes — add, remove, reorder, enable — so dragging a bloom slider
 *  costs one uniform write, not a composer rebuild.
 *
 *  A timeline cut swaps the whole chain, because a state owns its post chain: the store changes, and
 *  the rebuild below happens for the ordinary reason. It used to need a cut subscription to mask a
 *  shared chain, which is gone. */
export function PostChain() {
  const bypassed = usePostStore((s) => s.bypassed)
  const effects = usePostStore((s) => s.effects)
  return !bypassed && effects.some((e) => e.enabled) ? <PostComposer /> : null
}

interface StackEntry {
  instanceId: string
  handle: PostHandle
  /** Base values from the store. Replaced wholesale when the user edits a knob. */
  params: Record<string, ParamValue>
  /** Serialised modulation address per parameter, built once per stack shape. */
  keys: Record<string, string>
  /** Pre-allocated output of base + modulation. Reused every frame — the loop runs 60
   *  times a second and must not allocate. */
  resolved: Record<string, ParamValue>
}

function PostComposer() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  /** Last size the composer was built for. Compared against the live drawing buffer every
   *  frame — two number comparisons, and the only thing that catches an export resize. */
  const built = useRef(new Vector2())
  const buffer = useMemo(() => new Vector2(), [])

  const effects = usePostStore((s) => s.effects)

  // Identity + order of the live stack. Parameter edits deliberately do not change it.
  const shape = effects
    .filter((e) => e.enabled)
    .map((e) => `${e.id}:${e.effectId}`)
    .join('|')

  const composer = useMemo(() => {
    const instance = new EffectComposer(gl, {
      // Half float keeps bloom's bright pass from clipping before it is blended back,
      // and keeps a long feedback trail from banding once it decays below 1/255.
      frameBufferType: HalfFloatType,
      // Once the frame goes through a render target, the canvas's own MSAA no longer
      // applies. Without this every edge turns jagged the moment a first effect is added.
      multisampling: 4,
    })
    instance.autoRenderToScreen = true
    return instance
  }, [gl])

  const renderPass = useMemo(() => new RenderPass(scene, camera), [scene, camera])
  const stack = useRef<StackEntry[]>([])

  // ─── Build / rebuild when the stack's shape changes ───
  //
  // Every handle is recreated, never carried across a rebuild. That is deliberate:
  // EffectPass.dispose() also disposes the effects it merged, so a surviving effect
  // would either be freed underneath its handle or leave a stale listener on a dead
  // pass. Rebuilding from scratch makes ownership unambiguous, and it only happens on a
  // deliberate edit — never during playback.
  useEffect(() => {
    const live = usePostStore.getState().effects.filter((e) => e.enabled)

    const entries: StackEntry[] = []
    const passes: Pass[] = []
    let run: Effect[] = []

    const flush = () => {
      if (run.length === 0) return
      passes.push(new EffectPass(camera, ...run))
      run = []
    }

    for (const instance of live) {
      const brick = PostRegistry.get(instance.effectId)
      if (!brick) continue

      const handle = brick.create()
      const keys: Record<string, string> = {}
      for (const descriptor of brick.descriptors) {
        keys[descriptor.key] = addressKey(POST_STACK_ID, descriptor.key, instance.id)
      }
      entries.push({
        instanceId: instance.id,
        handle,
        keys,
        params: instance.params,
        resolved: { ...instance.params },
      })

      // Adjacent mergeable Effects compile into ONE fullscreen pass, so a five-effect
      // colour chain costs about what one costs. A `Pass` owns render targets, and a
      // convolution effect reads the buffer away from its own pixel; both break the run.
      const node = handle.node
      if (node instanceof Pass) {
        flush()
        passes.push(node)
      } else if (brick.standalone) {
        flush()
        passes.push(new EffectPass(camera, node))
      } else {
        run.push(node)
      }
    }
    flush()

    stack.current = entries
    composer.removeAllPasses()
    composer.addPass(renderPass)
    for (const pass of passes) composer.addPass(pass)

    gl.getDrawingBufferSize(built.current)
    composer.setSize(built.current.x, built.current.y)

    return () => {
      composer.removeAllPasses()
      // Disposing the handle frees its node — the Effect or the feedback Pass. The
      // EffectPass wrappers own only their own material, and disposing them here would
      // free those effects a second time, so they are freed directly instead.
      for (const pass of passes) {
        if (pass instanceof EffectPass) pass.fullscreenMaterial.dispose()
      }
      for (const entry of entries) entry.handle.dispose()
      stack.current = []
    }
    // `shape` is the real dependency; `effects` is a fresh array on every knob edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, composer, renderPass, camera, gl])

  // Base values track the store without touching the composer.
  useEffect(() => {
    for (const entry of stack.current) {
      const instance = effects.find((e) => e.id === entry.instanceId)
      if (instance) entry.params = instance.params
    }
  }, [effects])

  useEffect(() => {
    composer.setMainScene(scene)
    composer.setMainCamera(camera)
  }, [composer, scene, camera])

  useEffect(
    () => () => {
      composer.dispose()
      // EffectComposer disables auto-clear on construction. Left off, R3F's own render
      // path would accumulate frames once this unmounts.
      gl.autoClear = true
      gl.setRenderTarget(null)
    },
    [composer, gl],
  )

  const context = useRef<PostContext>({ time: 0, dt: 0, width: 1, height: 1 })

  useFrame((_, delta) => {
    // Resize checked here rather than in an effect, because an export changes the drawing
    // buffer without React ever hearing about it.
    gl.getDrawingBufferSize(buffer)
    if (buffer.x !== built.current.x || buffer.y !== built.current.y) {
      built.current.copy(buffer)
      composer.setSize(buffer.x, buffer.y)
    }

    const ctx = context.current
    ctx.time = activeClock().time
    ctx.dt = delta
    // Resolution-dependent effects — kaleidoscope's aspect, grain's cell size — must read
    // the buffer they are actually writing into, or they change appearance on export.
    ctx.width = buffer.x
    ctx.height = buffer.y

    for (const entry of stack.current) {
      for (const key in entry.params) {
        const base = entry.params[key]
        entry.resolved[key] =
          typeof base === 'number' ? base + ModulationMatrix.getOffset(entry.keys[key]) : base
      }
      entry.handle.update(entry.resolved, ctx)
    }

    // Priority ≥ 1 suppresses R3F's own render, so this call *is* the frame.
    composer.render(delta)
  }, 1)

  return null
}
