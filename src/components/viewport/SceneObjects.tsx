import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { EffectRegistry } from '@/engine/scene/EffectRegistry'
import { DeformRuntime } from '@/engine/scene/DeformRuntime'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { readToken } from '@/utils/tokens'
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

  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const outlineRef = useRef<THREE.Mesh>(null)

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
      roughness: k('material.roughness'),
      metalness: k('material.metalness'),
      emissiveIntensity: k('material.emissiveIntensity'),
      opacity: k('material.opacity'),
    }
  }, [object.id])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const { position, rotation, scale } = object.transform
    const M = ModulationMatrix

    // ─── Deformers: displace vertices, never rebuild the mesh ───
    if (geometry && deform.current) {
      const resolved = deform.current.resolve(
        geometry,
        object.effects,
        (effect) => {
          const keys = effectKeys.get(effect.id)
          const out: Record<string, number> = {}
          for (const [key, raw] of Object.entries(effect.params)) {
            out[key] =
              typeof raw === 'number' && keys ? raw + M.getOffset(keys[key]) : (raw as number)
          }
          return out
        },
      )
      if (mesh.geometry !== resolved) mesh.geometry = resolved
      // The selection shell must track the deformed mesh, or the outline floats away
      // from the shape the moment anything displaces it.
      const outline = outlineRef.current
      if (outline && outline.geometry !== resolved) outline.geometry = resolved
    }

    mesh.position.set(
      position[0] + M.getOffset(keys.px),
      position[1] + M.getOffset(keys.py),
      position[2] + M.getOffset(keys.pz),
    )

    // Rotation is authored in degrees (descriptor unit 'deg'); Three works in radians.
    mesh.rotation.set(
      (rotation[0] + M.getOffset(keys.rx)) * DEG_TO_RAD,
      (rotation[1] + M.getOffset(keys.ry)) * DEG_TO_RAD,
      (rotation[2] + M.getOffset(keys.rz)) * DEG_TO_RAD,
    )

    // scale.uniform is a first-class target because "pulse with the kick" is the single
    // most common routing in the product. It adds to all three axes on top of any
    // per-axis modulation.
    const uniform = M.getOffset(keys.su)
    mesh.scale.set(
      Math.max(0.001, scale[0] + uniform + M.getOffset(keys.sx)),
      Math.max(0.001, scale[1] + uniform + M.getOffset(keys.sy)),
      Math.max(0.001, scale[2] + uniform + M.getOffset(keys.sz)),
    )

    const material = materialRef.current
    if (material) {
      material.roughness = clamp(object.material.roughness + M.getOffset(keys.roughness), 0, 1)
      material.metalness = clamp(object.material.metalness + M.getOffset(keys.metalness), 0, 1)
      material.emissiveIntensity = Math.max(
        0,
        object.material.emissiveIntensity + M.getOffset(keys.emissiveIntensity),
      )
      const opacity = clamp(object.material.opacity + M.getOffset(keys.opacity), 0, 1)
      material.opacity = opacity
      // Toggling `transparent` recompiles the shader, so only touch it on a real change.
      const needsTransparent = opacity < 1
      if (material.transparent !== needsTransparent) {
        material.transparent = needsTransparent
        material.needsUpdate = true
      }
    }
  })

  if (!object.visible || !geometry) return null

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (object.locked) return
        e.stopPropagation()
        select(object.id)
      }}
    >
      <meshStandardMaterial
        ref={materialRef}
        color={object.material.color}
        roughness={object.material.roughness}
        metalness={object.material.metalness}
        emissive={object.material.emissive}
        emissiveIntensity={object.material.emissiveIntensity}
        opacity={object.material.opacity}
        transparent={object.material.opacity < 1}
        wireframe={object.material.wireframe}
        flatShading={object.material.flatShading}
        side={THREE.DoubleSide}
      />

      {/* Selection outline. Inflated back-face shell — cheap, needs no post-processing
          pass, and stays correct from any camera angle. Inherits the parent's
          modulated transform for free. */}
      {isSelected && (
        <mesh ref={outlineRef} geometry={geometry} scale={1.015} raycast={() => {}}>
          <meshBasicMaterial
            color={readToken('--color-aura-accent', '#6366f1')}
            side={THREE.BackSide}
            wireframe
          />
        </mesh>
      )}
    </mesh>
  )
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
