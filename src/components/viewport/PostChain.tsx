import { useEffect, useMemo, useRef, useState } from 'react'
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
  const alive = useContextAlive()
  return alive && !bypassed && effects.some((e) => e.enabled) ? <PostComposer /> : null
}

/** Is the WebGL context usable right now?
 *
 *  Three recovers from a lost context on its own — geometries, textures and programs are re-uploaded
 *  on restore. `EffectComposer` does not: its constructor reads
 *  `renderer.getContext().getContextAttributes().alpha`, and a lost context returns `null` there, so
 *  building or rebuilding a chain while the context is down throws
 *  `Cannot read properties of null (reading 'alpha')` and takes the viewport down with it.
 *
 *  So the chain unmounts for the duration and remounts on restore, which rebuilds it from the store
 *  exactly as an ordinary edit would. The picture returns without the post effects for a moment
 *  rather than the panel turning into an error boundary. */
function useContextAlive(): boolean {
  const gl = useThree((s) => s.gl)
  const [alive, setAlive] = useState(true)

  useEffect(() => {
    const canvas = gl.domElement
    const lost = () => setAlive(false)
    const restored = () => setAlive(true)

    // Three already calls preventDefault on its own listener, which is what permits restoration.
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    setAlive(!gl.getContext().isContextLost())

    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl])

  return alive
}

/** MSAA samples for a buffer of this many pixels.
 *
 *  **This is the fix for a context loss that killed the whole viewport**, and the arithmetic is worth
 *  keeping. The composer holds an input and an output buffer, both `HalfFloatType` — eight bytes a
 *  pixel — and multisampling multiplies each by the sample count. At a docked 1200×700 panel on a
 *  2× display that is 2.4 MB × 8 × 4 ≈ 77 MB, which is nothing. Full screen on the same display is
 *  3840×2160: **265 MB per buffer**, 530 MB for the pair, before bloom's mip chain or a feedback
 *  pass's two more targets. The driver refuses the allocation
 *  (`glRenderbufferStorageMultisample: Texture total allocation size is too large`), every attachment
 *  comes back zero-sized, and the context is gone.
 *
 *  Stepping the sample count down with area keeps edges clean where the cost is affordable and keeps
 *  the context alive where it is not. Aliased edges in full screen are a fair trade for a viewport
 *  that still exists — and above this size the pixels are small enough that MSAA buys less anyway. */
function samplesFor(pixels: number): number {
  if (pixels <= 2_500_000) return 4
  if (pixels <= 5_000_000) return 2
  return 0
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
  /** Reused by `resize` — it runs from the frame loop and must not allocate. */
  const scratch = useMemo(() => new Vector2(), [])

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
      // applies. Without this every edge turns jagged the moment a first effect is added —
      // but the sample count has to follow the buffer size or the allocation kills the
      // context outright. `resize` below owns it from here.
      multisampling: 4,
    })
    instance.autoRenderToScreen = true
    return instance
  }, [gl])

  /** Re-size the composer's buffers, and never the renderer.
   *
   *  **`EffectComposer.setSize` resizes the renderer as a side effect**, and that is the whole bug
   *  behind "adding a post effect kills the viewport". Its implementation is:
   *
   *  ```js
   *  if (renderer.getSize() !== (width, height)) renderer.setSize(width, height, updateStyle)
   *  const dbs = renderer.getDrawingBufferSize()
   *  inputBuffer.setSize(dbs); outputBuffer.setSize(dbs); passes.forEach(p => p.setSize(dbs))
   *  ```
   *
   *  It already sizes every buffer from the drawing buffer on its own. So passing the *drawing
   *  buffer* into it — which is what this file did, for the good reason recorded in D-66 — made it
   *  set the renderer's CSS size to the drawing-buffer size, whereupon the drawing buffer became
   *  that times the pixel ratio, which the next frame detected as a change and fed back in.
   *  **A runaway feedback loop that multiplied the canvas by the pixel ratio every frame** until the
   *  allocation exceeded what the driver would give (`Texture total allocation size is too large`),
   *  every attachment came back zero-sized, and the context was lost. Measured: 1338 CSS px grew to
   *  8192 within three frames, a 199-megapixel drawing buffer.
   *
   *  Passing the renderer's own size makes the comparison match, so the renderer is left alone and
   *  only the buffers are sized — from the drawing buffer, which is what D-66 actually wanted. */
  const resize = useMemo(
    () => () => {
      const samples = samplesFor(buffer.x * buffer.y)
      if (composer.multisampling !== samples) composer.multisampling = samples

      const size = gl.getSize(scratch)
      composer.setSize(Math.max(1, size.x), Math.max(1, size.y))
    },
    [composer, gl, buffer, scratch],
  )

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
    buffer.copy(built.current)
    resize()

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
  }, [shape, composer, renderPass, camera, gl, resize])

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
      resize()
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
