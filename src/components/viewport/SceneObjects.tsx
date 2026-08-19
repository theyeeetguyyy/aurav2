import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'
import { DeformRuntime } from '@/engine/scene/DeformRuntime'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { CloneRuntime, hasCloner } from '@/engine/scene/cloners/CloneRuntime'
import { MAX_CLONES } from '@/engine/scene/cloners/types'
import { MaterialRegistry } from '@/engine/scene/materials/MaterialRegistry'
import { materialKey } from '@/engine/scene/materials/types'
import { paletteAt, shiftHue } from '@/engine/scene/palette'
import { activeClock } from '@/engine/time/timeAuthority'
import { GIZMO_LAYER, SceneLight } from './SceneLight'
import { readToken } from '@/utils/tokens'
import type { ParamValue } from '@/types/params'
import type { SceneObject } from '@/types/visual'

const DEG_TO_RAD = Math.PI / 180

/** Above this many triangles, selection switches from a hugging shell to a bounding box.
 *
 *  The inflated back-face shell is the better indicator on a simple shape — it traces the
 *  silhouette exactly. On a subdivided one it is a mesh of hundreds of lines drawn over the
 *  art, which hides the thing it is meant to point at. A box is less precise and always
 *  legible, and precision is not what a selection indicator is for. */
const OUTLINE_SHELL_MAX_TRIANGLES = 600

/** Renders the SceneObject layer stack.
 *
 *  Geometry comes from BrickRegistry, which caches by brick + parameter signature, so
 *  a re-render that does not change parameters reuses the same BufferGeometry rather
 *  than rebuilding it. Geometries are owned by the registry — never disposed here.
 *
 *  Modulation is applied imperatively in useFrame, straight onto the Three.js objects.
 *  It never passes through React state or props (HC-1): audio-driven values change 60
 *  times a second, and routing them through a re-render is the single most common way
 *  audio-reactive R3F projects grind to a halt. */
export function SceneObjects() {
  const objects = useSceneStore((s) => s.objects)

  return (
    <>
      {objects.map((object) =>
        object.type === 'light' ? (
          <SceneLight key={object.id} object={object} />
        ) : (
          <SceneObjectMesh key={object.id} object={object} />
        ),
      )}
    </>
  )
}

function SceneObjectMesh({ object }: { object: SceneObject }) {
  const select = useSceneStore((s) => s.select)
  // Subscribed, not read per frame: a palette changes on a deliberate edit, and re-rendering for
  // it is correct — it is the material's *shape* changing, not its value.
  const palette = useSceneStore((s) => s.palette)
  const isSelected = useSceneStore((s) => s.selectedId === object.id)

  // The group carries the object's own transform; the mesh below it carries either one
  // copy or an instanced array of them.
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const instancedRef = useRef<THREE.InstancedMesh>(null)
  const outlineRef = useRef<THREE.Mesh>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  /** Selection box for a cloned object — one wireframe cube around the whole array. */
  const selectionRef = useRef<THREE.Mesh>(null)

  // Cloning a point cloud would be MAX_CLONES × the point count of instanced draws, which is a
  // different feature and not a useful one — the cloud is already the multiplicity. `InstancedMesh`
  // also has no line equivalent, and a strand's own Strands parameter already covers multiplicity.
  const isPoints = object.backend === 'points'
  const isLines = object.backend === 'lines'
  const cloned = hasCloner(object.effects) && !isPoints && !isLines

  // One clone runtime per object, allocated at MAX_CLONES so raising the count at frame
  // rate never allocates.
  const clone = useRef<CloneRuntime>(null)
  if (cloned) clone.current ??= new CloneRuntime()

  // One material instance per object, rebuilt only when the shading model changes.
  // Values are written into it every frame; swapping models is a deliberate edit.
  const materialBrick = MaterialRegistry.get(object.materialId) ?? MaterialRegistry.get('mat-standard')
  const material = useMemo(() => materialBrick?.create() ?? null, [materialBrick])
  useEffect(() => () => material?.dispose(), [material])

  // Address keys for the material's own parameters. Which keys exist depends on the
  // model, so they are rebuilt when it changes rather than hardcoded.
  const materialKeys = useMemo(() => {
    const map: Record<string, string> = {}
    for (const descriptor of materialBrick?.descriptors ?? []) {
      const key = materialKey(descriptor.key)
      map[key] = addressKey(object.id, descriptor.key)
    }
    return map
  }, [materialBrick, object.id])

  // Which of this model's values are colours. The hue shift moves all of them together — a Gradient's
  // two stops have to rotate as one or the ramp changes shape rather than hue.
  const colourKeys = useMemo(
    () =>
      (materialBrick?.descriptors ?? [])
        .filter((d) => d.type === 'color')
        .map((d) => materialKey(d.key)),
    [materialBrick],
  )

  // Reused every frame — resolving material values must not allocate.
  const resolvedMaterial = useRef<Record<string, ParamValue>>({})
  /** The object's resolved colour, handed to the clone runtime to seed its colour channel.
   *  Reused — this runs every frame and must not allocate. */
  const baseColour = useMemo(() => new THREE.Color(), [])

  // One deform runtime per object, owning its private working geometry. Released
  // automatically whenever the stack has nothing that displaces vertices.
  const deform = useRef<DeformRuntime>(null)
  deform.current ??= new DeformRuntime()
  useEffect(() => () => deform.current?.dispose(), [])

  const geometry = useMemo(
    () => BrickRegistry.buildGeometry(object.brickId, object.params),
    [object.brickId, object.params],
  )

  const denseGeometry = useMemo(() => {
    if (!geometry) return false
    const vertices = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
    return vertices / 3 > OUTLINE_SHELL_MAX_TRIANGLES
  }, [geometry])

  // Address keys for every effect parameter, built once per stack shape rather than
  // per frame. Deformer params are modulation targets like any other (HC-5).
  const effectKeys = useMemo(() => {
    const map = new Map<string, Record<string, string>>()
    for (const effect of object.effects) {
      const brick = EffectRegistry.get(effect.effectId)
      if (!brick) continue
      const keys: Record<string, string> = {}
      for (const descriptor of brick.descriptors) {
        keys[descriptor.key] = addressKey(object.id, descriptor.key, effect.id)
      }
      map.set(effect.id, keys)
    }
    return map
  }, [object.id, object.effects])

  // Address keys are read every frame for every driven parameter. Building the strings
  // once per object keeps the frame loop allocation-free.
  const keys = useMemo(() => {
    const k = (paramKey: string) => addressKey(object.id, paramKey)
    return {
      px: k('position.x'), py: k('position.y'), pz: k('position.z'),
      rx: k('rotation.x'), ry: k('rotation.y'), rz: k('rotation.z'),
      sx: k('scale.x'), sy: k('scale.y'), sz: k('scale.z'), su: k('scale.uniform'),
    }
  }, [object.id])

  // Resolved effect parameters. Shared by the deform and clone runtimes — both walk the
  // same stack and want base value plus modulation.
  const resolveEffectParams = useMemo(
    () => (effect: (typeof object.effects)[number]) => {
      const effectKeyMap = effectKeys.get(effect.id)
      const out: Record<string, ParamValue> = {}
      for (const key in effect.params) {
        const raw = effect.params[key]
        out[key] =
          typeof raw === 'number' && effectKeyMap
            ? raw + ModulationMatrix.getOffset(effectKeyMap[key])
            : raw
      }
      return out
    },
    [effectKeys],
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const { position, rotation, scale } = object.transform
    const M = ModulationMatrix

    // ─── Deformers: displace vertices, never rebuild the mesh ───
    if (geometry && deform.current) {
      const resolved = deform.current.resolve(
        geometry,
        object.effects,
        (effect) => resolveEffectParams(effect) as Record<string, number>,
        // The object's own geometry parameters, so a morph target is built at this object's size
        // rather than at the target brick's defaults.
        object.params,
      )
      // Points included: a deformer displaces vertices, and a point IS a vertex — which is what
      // makes all fifteen of them work on a cloud without a line of point-specific code.
      for (const target of [
        meshRef.current,
        instancedRef.current,
        outlineRef.current,
        pointsRef.current,
        linesRef.current,
      ]) {
        if (target && target.geometry !== resolved) target.geometry = resolved
      }
    }

    // ─── The object's own transform lives on the group ───
    // Clones are placed relative to it, so moving the object moves the whole array and
    // the cloner never has to know the object's transform exists.
    group.position.set(
      position[0] + M.getOffset(keys.px),
      position[1] + M.getOffset(keys.py),
      position[2] + M.getOffset(keys.pz),
    )

    // Rotation is authored in degrees (descriptor unit 'deg'); Three works in radians.
    group.rotation.set(
      (rotation[0] + M.getOffset(keys.rx)) * DEG_TO_RAD,
      (rotation[1] + M.getOffset(keys.ry)) * DEG_TO_RAD,
      (rotation[2] + M.getOffset(keys.rz)) * DEG_TO_RAD,
    )

    // scale.uniform is a first-class target because "pulse with the kick" is the single
    // most common routing in the product. It adds to all three axes on top of any
    // per-axis modulation.
    const uniform = M.getOffset(keys.su)
    group.scale.set(
      Math.max(0.001, scale[0] + uniform + M.getOffset(keys.sx)),
      Math.max(0.001, scale[1] + uniform + M.getOffset(keys.sy)),
      Math.max(0.001, scale[2] + uniform + M.getOffset(keys.sz)),
    )

    // ─── Material, before the cloners: they seed their colour channel from its result ───
    if (material) {
      const values = resolvedMaterial.current
      for (const key in object.material) {
        const base = object.material[key]
        values[key] =
          typeof base === 'number' ? base + M.getOffset(materialKeys[key]) : base
      }
      // The palette wins when the object is bound to a slot. Resolved here rather than written into
      // `object.material`, so re-picking the palette recolours the scene without touching every
      // object — the whole point of a slot. Setting a colour by hand releases the slot, which is
      // what makes the per-object picker work (`setMaterial`).
      if (object.paletteSlot !== null) {
        values.color = paletteAt(palette, object.paletteSlot)
      }

      // Hue shift, last: it rotates whatever the model and the palette resolved to, which is what
      // lets one control move a Gradient's two stops together and survive a change of shading model.
      // Modulated like any other material value, so a stem wired here changes the colour of the
      // piece on the drop rather than only its size.
      const hue = (typeof object.material.hueShift === 'number' ? object.material.hueShift : 0) +
        M.getOffset(materialKeys.hueShift)
      if (hue !== 0) {
        for (const key of colourKeys) {
          const colour = values[key]
          if (typeof colour === 'string') values[key] = shiftHue(colour, hue)
        }
      }

      baseColour.set(String(values.color ?? '#ffffff'))

      // An instanced mesh carries its colour per instance, and Three MULTIPLIES the material colour
      // by it — so the material has to be white or every clone would be tinted twice.
      material.update(cloned ? { ...values, color: '#ffffff' } : values)
    }

    // ─── Cloners: one mesh drawn N times, never N meshes ───
    const instanced = instancedRef.current
    if (instanced && clone.current) {
      clone.current.resolve(
        object.effects,
        activeClock().time,
        resolveEffectParams,
        baseColour,
        palette,
        // The instanced mesh's own geometry — already the deformed copy when a deformer is stacked,
        // so a surface layout follows the shape instead of where it started.
        instanced.geometry,
      )
      clone.current.applyTo(instanced)

      // Selection for a cloned object is ONE wireframe box around the whole array, not
      // a shell per clone. Two reasons: sixty-four wireframe shells obscure the art they
      // are meant to indicate, and the earlier version shared the instance matrix
      // attribute between the two meshes — so unmounting the outline on deselect freed
      // the buffer the visible mesh was still drawing from, and clones disappeared.
      const box = selectionRef.current
      if (box) {
        const { center, radius } = clone.current.bounds
        box.position.copy(center)
        box.scale.setScalar(Math.max(0.001, radius * 2))
      }
    } else if (selectionRef.current && geometry) {
      // A dense single mesh gets the same box, sized from its own bounds. Read from the
      // geometry rather than the mesh so a deformer's displaced vertices are included — the
      // bounding sphere is recomputed when the working geometry changes.
      geometry.computeBoundingSphere()
      const bounds = geometry.boundingSphere
      if (bounds) {
        selectionRef.current.position.copy(bounds.center)
        selectionRef.current.scale.setScalar(Math.max(0.001, bounds.radius * 2))
      }
    }

    for (const target of [
      meshRef.current,
      instancedRef.current,
      pointsRef.current,
      linesRef.current,
    ]) {
      if (target) target.visible = object.visible
    }


  })

  if (!geometry || !material) return null

  const onSelect = (e: { stopPropagation: () => void }) => {
    if (object.locked) return
    e.stopPropagation()
    select(object.id)
  }

  const outlineColour = readToken('--color-aura-accent', '#6366f1')

  return (
    <group ref={groupRef}>
      {isPoints ? (
        // A cloud, not a surface. Points take no part in shadows — they have no normals, so a
        // shadow map would be a square per point — and they are not raycast: hitting a single dot
        // is not a gesture anyone can perform, so selection is via the layer stack.
        <points ref={pointsRef} geometry={geometry} material={material.material} />
      ) : isLines ? (
        // A drawing, not a surface. Always `lineSegments` and never `line`: every line brick carries
        // its own index of vertex pairs, which is what lets one backend draw both connected strands
        // and a web of links between scattered nodes. Excluded from shadows and raycasting for the
        // same reasons as a cloud.
        <lineSegments ref={linesRef} geometry={geometry} material={material.material} />
      ) : cloned ? (
        // `count` is deliberately not a prop: it is owned by useFrame, and passing it
        // would reset the array to zero instances on every unrelated re-render.
        <instancedMesh
          ref={instancedRef}
          args={[geometry, material.material, MAX_CLONES]}
          castShadow
          receiveShadow
          onClick={onSelect}
        />
      ) : (
        <mesh
          ref={meshRef}
          geometry={geometry}
          material={material.material}
          castShadow
          receiveShadow
          onClick={onSelect}
        />
      )}

      {/* Selection outline. Inflated back-face shell — cheap, needs no post-processing
          pass, and stays correct from any camera angle. Inherits the group's modulated
          transform, and for a cloned object the clone matrices too.

          On GIZMO_LAYER, like the light gizmos: both cameras show it while authoring and the
          exporter disables it, so selecting a shape before pressing Export no longer bakes a
          wireframe cage into the video. */}
      {isSelected &&
        (cloned || denseGeometry || isPoints || isLines ? (
          <mesh ref={selectionRef} raycast={() => {}} layers-mask={1 << GIZMO_LAYER}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={outlineColour} wireframe transparent opacity={0.35} />
          </mesh>
        ) : (
          <mesh
            ref={outlineRef}
            geometry={geometry}
            scale={1.015}
            raycast={() => {}}
            layers-mask={1 << GIZMO_LAYER}
          >
            <meshBasicMaterial color={outlineColour} side={THREE.BackSide} wireframe />
          </mesh>
        ))}
    </group>
  )
}
