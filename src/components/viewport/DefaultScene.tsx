import { Grid } from '@react-three/drei'
import * as THREE from 'three'

/** Clean studio lighting environment and infinite floor grid with high distance visibility.
 *  Uses hemisphere light for even 360° spatial illumination across far distances.
 *  Grid uses DoubleSide rendering so it remains visible from above and below. */
export function DefaultScene() {
  return (
    <>
      {/* ─── Studio Lighting Setup ─── */}
      {/* Hemisphere Light — even sky/ground ambient fill for far distance visibility */}
      <hemisphereLight
        args={['#f8fafc', '#1e1e26', 0.8]}
      />

      {/* Main Key Light (top-right-front) */}
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

      {/* Cyan Rim Fill Light */}
      <directionalLight
        position={[-30, 20, -30]}
        intensity={0.5}
        color="#06b6d4"
      />

      {/* Indigo Accent Rim Light */}
      <directionalLight
        position={[0, 40, -40]}
        intensity={0.7}
        color="#6366f1"
      />

      {/* ─── Spatial Floor Grid (Extended Horizon & Double-Sided) ─── */}
      <Grid
        position={[0, -10, 0]}
        args={[300, 300]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#3f3f46"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#6366f1"
        fadeDistance={250}
        fadeStrength={1.0}
        side={THREE.DoubleSide}
        infiniteGrid
      />
    </>
  )
}
