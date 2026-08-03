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
import { activeClock } from '@/engine/time/timeAuthority'
import { readToken } from '@/utils/tokens'
import type { ParamValue } from '@/types/params'
import type { SceneObject } from '@/types/visual'

const DEG_TO_RAD = Math.PI / 180

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
      {objects.map((object) => (
        <SceneObjectMesh key={object.id} object={object} />
      ))}
    </>
  )
}

function SceneObjectMesh({ object }: { object: SceneObject }) {
  const select = useSceneStore((s) => s.select)
  const isSelected = useSceneStore((s) => s.selectedId === object.id)

  // The group carries the object's own transform; the mesh below it carries either one
  // copy or an instanced array of them.
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const instancedRef = useRef<THREE.InstancedMesh>(null)
  const outlineRef = useRef<THREE.Mesh>(null)

  const cloned = hasCloner(object.effects)

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

  // Reused every frame — resolving material values must not allocate.
  const resolvedMaterial = useRef<Record<string, ParamValue>>({})

  // One deform runtime per object, owning its private working geometry. Released
  // automatically whenever the stack has nothing that displaces vertices.
  const deform = useRef<DeformRuntime>(null)
  deform.current ??= new DeformRuntime()
  useEffect(() => () => deform.current?.dispose(), [])

  const geometry = useMemo(
    () => BrickRegistry.buildGeometry(object.brickId, object.params),
    [object.brickId, object.params],
  )

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
      )
      for (const target of [meshRef.current, instancedRef.current, outlineRef.current]) {
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

    // ─── Cloners: one mesh drawn N times, never N meshes ───
    const instanced = instancedRef.current
    if (instanced && clone.current) {
      clone.current.resolve(object.effects, activeClock().time, resolveEffectParams)
      clone.current.applyTo(instanced)

      const outline = outlineRef.current
      if (outline instanceof THREE.InstancedMesh) {
        // Share the matrix attribute rather than recomputing it: the outline is the same
        // array of clones, one shell wider.
        outline.instanceMatrix = instanced.instanceMatrix
        outline.count = instanced.count
        outline.boundingSphere = instanced.boundingSphere
      }
    }

    if (material) {
      const values = resolvedMaterial.current
      for (const key in object.material) {
        const base = object.material[key]
        values[key] =
          typeof base === 'number' ? base + M.getOffset(materialKeys[key]) : base
      }
      material.update(values)
    }
  })

  if (!object.visible || !geometry || !material) return null

  const onSelect = (e: { stopPropagation: () => void }) => {
    if (object.locked) return
    e.stopPropagation()
    select(object.id)
  }

  const outlineColour = readToken('--color-aura-accent', '#6366f1')

  return (
    <group ref={groupRef}>
      {cloned ? (
        <instancedMesh
          ref={instancedRef}
          args={[geometry, material.material, MAX_CLONES]}
          count={0}
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
          transform, and for a cloned object the clone matrices too. */}
      {isSelected &&
        (cloned ? (
          <instancedMesh
            ref={outlineRef as React.Ref<THREE.InstancedMesh>}
            args={[geometry, undefined, MAX_CLONES]}
            count={0}
            scale={1.015}
            raycast={() => {}}
          >
            <meshBasicMaterial color={outlineColour} side={THREE.BackSide} wireframe />
          </instancedMesh>
        ) : (
          <mesh ref={outlineRef} geometry={geometry} scale={1.015} raycast={() => {}}>
            <meshBasicMaterial color={outlineColour} side={THREE.BackSide} wireframe />
          </mesh>
        ))}
    </group>
  )
}
