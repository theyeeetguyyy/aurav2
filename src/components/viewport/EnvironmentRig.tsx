import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ENV_SECTIONS, ENV_STACK_ID } from '@/engine/environment/sections'
import { ModulationMatrix, addressKey } from '@/engine/modulation/ModulationMatrix'
import { useEnvironmentStore } from '@/store/useEnvironmentStore'
import type { ParamValue } from '@/types/params'

/** The world — background, fog, lighting, reflections and the authoring grid
 *  (docs/10-ELEMENTS.md §E).
 *
 *  Replaces the hardcoded `DefaultScene`. Everything here is a parameter with a
 *  descriptor, so background intensity, fog density and light angles are modulation
 *  targets like anything else. Values are applied imperatively in `useFrame` (HC-1) —
 *  a light whose intensity is wired to the kick must not re-render React 60 times a
 *  second to prove it. */

const DEG = Math.PI / 180

/** Resolve one section's parameters for this frame: authored value plus modulation. */
function useSectionResolver(sectionId: string) {
  const keys = useMemo(() => {
    const section = ENV_SECTIONS.find((s) => s.id === sectionId)
    const map: Record<string, string> = {}
    for (const descriptor of section?.descriptors ?? []) {
      map[descriptor.key] = addressKey(ENV_STACK_ID, descriptor.key, sectionId)
    }
    return map
  }, [sectionId])

  return useMemo(
    () => (key: string, fallback: number): number => {
      const raw = useEnvironmentStore.getState().params[sectionId]?.[key]
      const base = typeof raw === 'number' ? raw : fallback
      return base + ModulationMatrix.getOffset(keys[key])
    },
    [sectionId, keys],
  )
}

function useSectionParams(sectionId: string): Record<string, ParamValue> {
  return useEnvironmentStore((s) => s.params[sectionId]) ?? {}
}

function useSectionEnabled(sectionId: string): boolean {
  return useEnvironmentStore((s) => s.disabled[sectionId] !== true)
}

export function EnvironmentRig() {
  return (
    <>
      <Background />
      <Fog />
      <Reflections />
      <Lighting />
      <AuthoringGrid />
    </>
  )
}

/** Vertical gradient sky as an equirectangular texture.
 *
 *  A texture rather than a backdrop mesh, because `scene.background` composites before
 *  everything with no depth cost, respects `backgroundIntensity`, and — the reason it is
 *  worth doing this way — the same gradient can later light the scene. */
function Background() {
  const scene = useThree((s) => s.scene)
  const params = useSectionParams('background')
  const resolve = useSectionResolver('background')

  const mode = String(params.mode ?? 'gradient')
  const top = String(params.topColor ?? '#1a1a2e')
  const bottom = String(params.bottomColor ?? '#05050a')

  useEffect(() => {
    if (mode === 'solid') {
      const colour = new THREE.Color(bottom)
      scene.background = colour
      return () => {
        scene.background = null
      }
    }

    const texture = gradientTexture(top, bottom)
    scene.background = texture
    return () => {
      scene.background = null
      texture.dispose()
    }
  }, [scene, mode, top, bottom])

  useFrame(() => {
    scene.backgroundIntensity = Math.max(0, resolve('intensity', 1))
  })

  return null
}

const GRADIENT_STEPS = 128

function gradientTexture(top: string, bottom: string): THREE.DataTexture {
  const data = new Uint8Array(GRADIENT_STEPS * 4)
  const a = new THREE.Color(bottom)
  const b = new THREE.Color(top)
  const mixed = new THREE.Color()

  for (let i = 0; i < GRADIENT_STEPS; i++) {
    // Smoothstep rather than linear: a linear ramp bands visibly across a large area,
    // and the eye reads the midpoint as a horizon line.
    const t = i / (GRADIENT_STEPS - 1)
    mixed.copy(a).lerp(b, t * t * (3 - 2 * t))
    data[i * 4 + 0] = Math.round(mixed.r * 255)
    data[i * 4 + 1] = Math.round(mixed.g * 255)
    data[i * 4 + 2] = Math.round(mixed.b * 255)
    data[i * 4 + 3] = 255
  }

  const texture = new THREE.DataTexture(data, 1, GRADIENT_STEPS)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function Fog() {
  const scene = useThree((s) => s.scene)
  const enabled = useSectionEnabled('fog')
  const params = useSectionParams('fog')
  const resolve = useSectionResolver('fog')

  const mode = String(params.mode ?? 'exp2')
  const colour = String(params.color ?? '#05050a')

  const fog = useMemo(
    () =>
      mode === 'linear'
        ? new THREE.Fog(colour, 20, 220)
        : new THREE.FogExp2(colour, 0.008),
    [mode, colour],
  )

  useEffect(() => {
    if (!enabled) return
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, fog, enabled])

  useFrame(() => {
    if (!enabled) return
    if (fog instanceof THREE.FogExp2) {
      fog.density = Math.max(0, resolve('density', 0.008))
    } else {
      const near = resolve('near', 20)
      fog.near = near
      // Clamping keeps a modulated `near` from crossing `far`, which renders the whole
      // scene as flat fog colour rather than as an error anyone could diagnose.
      fog.far = Math.max(near + 0.1, resolve('far', 220))
    }
  })

  return null
}

/** Procedural studio environment for image-based lighting.
 *
 *  Generated from `RoomEnvironment` rather than loaded from an HDRI: no asset, no
 *  network, and it is the single largest improvement to how metal and rough surfaces
 *  read. Without it every PBR material is lit only by three directional lights and
 *  reflects nothing, which is exactly what "looks like grey plastic" means. */
function Reflections() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const enabled = useSectionEnabled('reflections')
  const resolve = useSectionResolver('reflections')

  useEffect(() => {
    if (!enabled) return

    const pmrem = new THREE.PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = pmrem.fromScene(room, 0.04)

    scene.environment = target.texture

    return () => {
      scene.environment = null
      target.dispose()
      room.dispose?.()
      pmrem.dispose()
    }
  }, [gl, scene, enabled])

  useFrame(() => {
    scene.environmentIntensity = enabled ? Math.max(0, resolve('intensity', 1)) : 0
  })

  return null
}

function Lighting() {
  const params = useSectionParams('lighting')
  const resolve = useSectionResolver('lighting')

  const ambientRef = useRef<THREE.HemisphereLight>(null)
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const rimRef = useRef<THREE.DirectionalLight>(null)

  const shadows = params.shadows !== false
  const KEY_DISTANCE = 60

  useFrame(() => {
    if (ambientRef.current) ambientRef.current.intensity = Math.max(0, resolve('ambient', 0.6))

    const key = keyRef.current
    if (key) {
      key.intensity = Math.max(0, resolve('keyIntensity', 2.2))
      const azimuth = resolve('keyAzimuth', 40) * DEG
      const elevation = resolve('keyElevation', 45) * DEG
      key.position.set(
        KEY_DISTANCE * Math.cos(elevation) * Math.sin(azimuth),
        KEY_DISTANCE * Math.sin(elevation),
        KEY_DISTANCE * Math.cos(elevation) * Math.cos(azimuth),
      )
    }

    if (fillRef.current) fillRef.current.intensity = Math.max(0, resolve('fillIntensity', 0.6))
    if (rimRef.current) rimRef.current.intensity = Math.max(0, resolve('rimIntensity', 1.1))
  })

  return (
    <>
      <hemisphereLight
        ref={ambientRef}
        args={[
          String(params.keyColor ?? '#ffffff'),
          String(params.fillColor ?? '#06b6d4'),
          0.6,
        ]}
      />

      <directionalLight
        ref={keyRef}
        color={String(params.keyColor ?? '#ffffff')}
        position={[30, 50, 30]}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />

      <directionalLight
        ref={fillRef}
        color={String(params.fillColor ?? '#06b6d4')}
        position={[-40, 15, -25]}
      />

      {/* Behind and above: a rim separates the silhouette from the background, which is
          what stops a dark scene reading as a blob. */}
      <directionalLight
        ref={rimRef}
        color={String(params.rimColor ?? '#6366f1')}
        position={[0, 35, -55]}
      />
    </>
  )
}

function AuthoringGrid() {
  const enabled = useSectionEnabled('grid')
  const params = useSectionParams('grid')
  const resolve = useSectionResolver('grid')
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (ref.current) ref.current.position.y = resolve('height', -10)
  })

  if (!enabled) return null

  return (
    <Grid
      ref={ref}
      position={[0, Number(params.height ?? -10), 0]}
      args={[300, 300]}
      cellSize={Number(params.cellSize ?? 1)}
      cellThickness={0.6}
      cellColor={String(params.cellColor ?? '#3f3f46')}
      sectionSize={Number(params.sectionSize ?? 5)}
      sectionThickness={1.2}
      sectionColor={String(params.sectionColor ?? '#6366f1')}
      fadeDistance={Number(params.fadeDistance ?? 250)}
      fadeStrength={1}
      side={THREE.DoubleSide}
      infiniteGrid
    />
  )
}
