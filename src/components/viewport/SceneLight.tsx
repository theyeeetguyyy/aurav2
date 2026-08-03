import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSceneStore } from '@/store/useSceneStore'
import { LightRegistry } from '@/engine/scene/lights/LightRegistry'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { readToken } from '@/utils/tokens'
import type { ParamValue } from '@/types/params'
import type { SceneObject } from '@/types/visual'

/** Renders one light SceneObject.
 *
 *  Structurally identical to `SceneObjectMesh`: the transform goes on a group, the
 *  brick's parameters are resolved with modulation applied and written imperatively every
 *  frame (HC-1). A light's `intensity` is therefore a modulation target with no extra
 *  machinery — and an onset trigger into it is a strobe (D-30). */

const DEG_TO_RAD = Math.PI / 180

/** Objects on this layer are visible to the authoring viewport and to nothing else.
 *
 *  A light has no geometry, so without a gizmo it cannot be seen or clicked. But the
 *  viewport IS the render — anything drawn here would end up in the exported video. Three
 *  layers solve it exactly: the gizmo sits on its own layer, both cameras display it
 *  while authoring, and the exporter disables the layer on the Scene Camera for the
 *  render. That seam is the whole reason to use layers rather than a visibility flag. */
export const GIZMO_LAYER = 1

export function SceneLight({ object }: { object: SceneObject }) {
  const select = useSceneStore((s) => s.select)
  const isSelected = useSceneStore((s) => s.selectedId === object.id)

  const groupRef = useRef<THREE.Group>(null)
  const gizmoRef = useRef<THREE.Object3D>(null)

  const brick = LightRegistry.get(object.brickId)
  const handle = useMemo(() => brick?.create() ?? null, [brick])
  useEffect(() => () => handle?.dispose(), [handle])

  const keys = useMemo(() => {
    const map: Record<string, string> = {}
    for (const descriptor of brick?.descriptors ?? []) {
      map[descriptor.key] = addressKey(object.id, descriptor.key)
    }
    return map
  }, [brick, object.id])

  // Reused every frame — this runs 60 times a second and must not allocate.
  const resolved = useRef<Record<string, ParamValue>>({})

  useFrame(() => {
    const group = groupRef.current
    if (!group || !handle) return

    const { position, rotation } = object.transform
    const M = ModulationMatrix

    group.position.set(
      position[0] + M.getOffset(addressKey(object.id, 'position.x')),
      position[1] + M.getOffset(addressKey(object.id, 'position.y')),
      position[2] + M.getOffset(addressKey(object.id, 'position.z')),
    )
    group.rotation.set(
      (rotation[0] + M.getOffset(addressKey(object.id, 'rotation.x'))) * DEG_TO_RAD,
      (rotation[1] + M.getOffset(addressKey(object.id, 'rotation.y'))) * DEG_TO_RAD,
      (rotation[2] + M.getOffset(addressKey(object.id, 'rotation.z'))) * DEG_TO_RAD,
    )

    const values = resolved.current
    for (const key in object.params) {
      const base = object.params[key]
      values[key] = typeof base === 'number' ? base + M.getOffset(keys[key]) : base
    }
    handle.update(values)

    // The gizmo takes the light's own colour and brightens with it, so a strobe is
    // visible in the outliner's worth of space it occupies rather than being a guess.
    const gizmo = gizmoRef.current
    const material = (gizmo as THREE.Mesh | null)?.material as THREE.MeshBasicMaterial | undefined
    if (material) {
      const colour = values.color
      if (typeof colour === 'string') material.color.set(colour)
    }
  })

  if (!object.visible || !brick || !handle) return null

  return (
    <group ref={groupRef}>
      <primitive object={handle.light} />
      {handle.target && <primitive object={handle.target} />}

      {/* Authoring gizmo. On GIZMO_LAYER so it never reaches the render. */}
      <mesh
        ref={gizmoRef}
        layers-mask={1 << GIZMO_LAYER}
        onClick={(e) => {
          if (object.locked) return
          e.stopPropagation()
          select(object.id)
        }}
      >
        <octahedronGeometry args={[isSelected ? 1.1 : 0.8, 0]} />
        <meshBasicMaterial
          wireframe
          color={
            isSelected
              ? readToken('--color-aura-accent', '#6366f1')
              : readToken('--color-aura-state-solo', '#eab308')
          }
        />
      </mesh>
    </group>
  )
}
