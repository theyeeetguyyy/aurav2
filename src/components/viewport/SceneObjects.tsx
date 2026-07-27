import { useMemo } from 'react'
import * as THREE from 'three'
import { useSceneStore } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { readToken } from '@/utils/tokens'
import type { SceneObject } from '@/types/visual'

const DEG_TO_RAD = Math.PI / 180

/** Renders the SceneObject layer stack.
 *
 *  Geometry comes from BrickRegistry, which caches by brick + parameter signature, so
 *  a re-render that does not change parameters reuses the same BufferGeometry rather
 *  than rebuilding it. Geometries are owned by the registry — never disposed here. */
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

  const geometry = useMemo(
    () => BrickRegistry.buildGeometry(object.brickId, object.params),
    [object.brickId, object.params],
  )

  if (!object.visible || !geometry) return null

  const [rx, ry, rz] = object.transform.rotation

  return (
    <mesh
      geometry={geometry}
      position={object.transform.position}
      // Rotation is authored and displayed in degrees (see ParamRegistry unit 'deg');
      // Three.js works in radians.
      rotation={[rx * DEG_TO_RAD, ry * DEG_TO_RAD, rz * DEG_TO_RAD]}
      scale={object.transform.scale}
      castShadow
      receiveShadow
      onClick={(e) => {
        if (object.locked) return
        e.stopPropagation()
        select(object.id)
      }}
    >
      <meshStandardMaterial
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
          pass, and stays correct under any camera angle. */}
      {isSelected && (
        <mesh geometry={geometry} scale={1.015} raycast={() => {}}>
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
