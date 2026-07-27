import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { readToken } from '@/utils/tokens'

/** Studio lighting environment and spatial floor grid.
 *
 *  Colours are read from the design-system tokens in index.css rather than hardcoded,
 *  so the viewport and the surrounding chrome cannot drift apart
 *  (docs/05-DESIGN-SYSTEM.md §3). */
export function DefaultScene() {
  return (
    <>
      {/* Even sky/ground ambient fill, so distant geometry stays readable */}
      <hemisphereLight
        args={[
          readToken('--color-aura-light-sky', '#f8fafc'),
          readToken('--color-aura-light-ground', '#1e1e26'),
          0.8,
        ]}
      />

      {/* Key light */}
      <directionalLight
        position={[30, 50, 30]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      {/* Cool rim fill */}
      <directionalLight
        position={[-30, 20, -30]}
        intensity={0.5}
        color={readToken('--color-aura-light-rim-cool', '#06b6d4')}
      />

      {/* Accent rim */}
      <directionalLight
        position={[0, 40, -40]}
        intensity={0.7}
        color={readToken('--color-aura-light-rim-accent', '#6366f1')}
      />

      {/* Double-sided so the grid reads from above and below */}
      <Grid
        position={[0, -10, 0]}
        args={[300, 300]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={readToken('--color-aura-grid-cell', '#3f3f46')}
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor={readToken('--color-aura-grid-section', '#6366f1')}
        fadeDistance={250}
        fadeStrength={1}
        side={THREE.DoubleSide}
        infiniteGrid
      />
    </>
  )
}
