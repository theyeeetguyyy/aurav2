import * as THREE from 'three'
import { matColour, matParam, matToggle, type MaterialBrick, type MaterialHandle } from './types'
import type { ParamValue } from '@/types/params'

/** Materials for point clouds.
 *
 *  Separate bricks rather than a flag on the surface materials, because a point is not a surface and
 *  almost nothing transfers: there is no normal, so no shading model, no roughness and no metalness.
 *  What a point *does* have is size, and how that size behaves with distance — which is the control
 *  that decides whether a cloud reads as depth or as flat noise, and which no surface material has.
 *
 *  **Additive is the one that matters.** Points that add rather than occlude accumulate where the
 *  cloud is dense, so the form emerges from overlap instead of from lighting. That is the look
 *  everything from a starfield to a nebula to a particle burst is made of, and it is unreachable with
 *  the surface materials at any setting. */

function num(params: Record<string, ParamValue>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function str(params: Record<string, ParamValue>, key: string, fallback: string): string {
  const value = params[key]
  return typeof value === 'string' ? value : fallback
}

/** Shared controls. Size and attenuation are the two that define the medium.
 *
 *  `opacity` differs by blending mode, which is why this takes it as an argument. Additive light
 *  ACCUMULATES: at a few thousand overlapping sprites, opacity 1 saturates every channel and the
 *  cloud renders as a white smear with the colour surviving only at the thin edges. Verified by
 *  looking at it. A low default is what makes the colour read. */
function pointDescriptors(defaultOpacity: number) {
  return [
    matColour('color', 'Colour', '#6366f1'),
    // Range reaches well below 1: at a few thousand points a size of 0.2 reads as dust and 3 reads
    // as confetti, and both are wanted.
    matParam('size', 'Point Size', 0.01, 8, 0.6),
    matParam('opacity', 'Opacity', 0, 1, defaultOpacity),
    // Perspective sizing. On, distance shrinks a point and the cloud reads as volume; off, every
    // point is the same screen size and it reads as a flat field of stars.
    matToggle('sizeAttenuation', 'Perspective Size', true),
  ]
}

/** A round sprite, computed once and shared.
 *
 *  Points are square by default, and a cloud of squares reads as pixel noise rather than as dust.
 *
 *  Computed into a `DataTexture` rather than drawn on a canvas: `engine/` must not need a DOM. The
 *  canvas version worked in the browser and threw `document is not defined` the moment a test touched
 *  the registry — an engine that only runs inside a page is not an engine.
 *
 *  The falloff is soft rather than a hard circle, because overlapping hard discs band visibly where
 *  the cloud is dense, and what happens when additive points overlap is the entire appeal. */
let discTexture: THREE.Texture | null = null

const DISC_SIZE = 64

function disc(): THREE.Texture {
  if (discTexture) return discTexture

  // Luminance-alpha would be enough, but RGBA is the format every path supports without a branch.
  const data = new Uint8Array(DISC_SIZE * DISC_SIZE * 4)
  const centre = (DISC_SIZE - 1) / 2

  for (let y = 0; y < DISC_SIZE; y++) {
    for (let x = 0; x < DISC_SIZE; x++) {
      const dx = (x - centre) / centre
      const dy = (y - centre) / centre
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Full to 45% of the radius, then a smooth shoulder to nothing. `smoothstep` rather than a
      // linear ramp so the edge does not read as a visible ring at large point sizes.
      const t = Math.min(1, Math.max(0, (1 - distance) / 0.55))
      const alpha = distance <= 0.45 ? 1 : t * t * (3 - 2 * t)

      const o = (y * DISC_SIZE + x) * 4
      data[o] = 255
      data[o + 1] = 255
      data[o + 2] = 255
      data[o + 3] = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    }
  }

  discTexture = new THREE.DataTexture(data, DISC_SIZE, DISC_SIZE, THREE.RGBAFormat)
  discTexture.colorSpace = THREE.SRGBColorSpace
  discTexture.magFilter = THREE.LinearFilter
  // Deliberately unmipmapped. A point sprite is minified hard — 64² into about five pixels — so
  // mipmapping looks like the obvious fix, and it is the opposite: the coarse levels average the
  // falloff towards a uniform mid alpha, which flattens the shoulder the sprite exists for.
  discTexture.generateMipmaps = false
  discTexture.minFilter = THREE.LinearFilter
  discTexture.needsUpdate = true
  return discTexture
}

function pointHandle(blending: THREE.Blending, opacity: number): MaterialHandle {
  const material = new THREE.PointsMaterial({
    size: 0.6,
    opacity,
    sizeAttenuation: true,
    map: disc(),
    transparent: true,
    blending,
    // Never write depth — for both modes, and it took three attempts to land here.
    //
    // Additive obviously must not: points drawn first would occlude the ones behind them and the
    // accumulation the mode exists for would never happen. The plain mode must not either, and the
    // reason is subtler. A sprite's transparent corners still write depth, so every dot punches an
    // invisible square hole in whatever is behind it, and a dense cloud renders as hard squares.
    // `alphaTest` cures that by discarding the corners, but a four-pixel circle with a hard alpha
    // cutoff *is* a square — verified by magnifying one. Dropping depth writes keeps the soft sprite
    // and loses nothing visible: depth TESTING is still on, so the mesh in front still hides the dots
    // behind it. Only dot-versus-dot ordering becomes buffer order, which at four pixels is invisible.
    depthWrite: false,
    // Per-point colour, so the palette ramp and any future per-point colouring land here.
    vertexColors: false,
  })

  return {
    material,
    update(params) {
      material.color.set(str(params, 'color', '#6366f1'))
      material.size = Math.max(0.001, num(params, 'size', 0.6))
      material.opacity = num(params, 'opacity', 1)

      const attenuation = params.sizeAttenuation !== false
      if (material.sizeAttenuation !== attenuation) {
        material.sizeAttenuation = attenuation
        // A change of vertex-shader behaviour, not a uniform, so the program has to be rebuilt.
        material.needsUpdate = true
      }
    },
    dispose: () => material.dispose(),
  }
}

export const pointsMaterial: MaterialBrick = {
  id: 'mat-points',
  label: 'Points',
  hint: 'Soft round dots, opaque at the centre. The plain cloud — dust, sand, scatter.',
  descriptors: pointDescriptors(1),
  create: () => pointHandle(THREE.NormalBlending, 1),
}

export const pointsAdditiveMaterial: MaterialBrick = {
  id: 'mat-points-additive',
  label: 'Points (Additive)',
  hint: 'Dots that add where they overlap, so density becomes brightness. Starfields, nebulae, bursts.',
  descriptors: pointDescriptors(0.3),
  create: () => pointHandle(THREE.AdditiveBlending, 0.3),
}

export const POINT_MATERIAL_BRICKS: MaterialBrick[] = [pointsMaterial, pointsAdditiveMaterial]

/** Is this material meant for a point cloud?
 *
 *  The one authority. A `PointsMaterial` on a mesh renders nothing and a `MeshStandardMaterial` on
 *  `THREE.Points` renders squares with no shading — both look like bugs rather than choices, so the
 *  picker filters by backend and `buildObject` chooses a compatible default. */
export function isPointMaterial(id: string): boolean {
  return POINT_MATERIAL_BRICKS.some((brick) => brick.id === id)
}

export const DEFAULT_POINT_MATERIAL_ID = pointsAdditiveMaterial.id
