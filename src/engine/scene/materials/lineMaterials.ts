import * as THREE from 'three'
import { matColour, matParam, num, str, type MaterialBrick, type MaterialHandle } from './types'

/** Materials for line segments.
 *
 *  Separate bricks rather than a flag on the surface materials, for the same reason the point
 *  materials are separate: a stroke has no normal, so there is no shading model, no roughness and no
 *  metalness — every one of those controls would be a knob that does nothing. What a stroke has is
 *  colour and opacity, and *how it combines with what is behind it*.
 *
 *  **Additive is the one that matters**, and more here than for points. Strands cross constantly, so
 *  brightness accumulates exactly where the figure is dense: the knots of a Lissajous, the core of a
 *  braid, the hub of a web. That is the reason a wireframe reads as a technical drawing and a glowing
 *  filament reads as an image, and it costs one blending mode.
 *
 *  **Width is not a control.** WebGL rasterises every line at one pixel and ignores
 *  `LineBasicMaterial.linewidth`; three's own docs say so. Shipping a Width slider that silently did
 *  nothing would be the "control with no handler" failure this project has logged three times. Weight
 *  comes from the Ribbon bricks, which sweep a real section along the same path. */

function lineHandle(blending: THREE.Blending, opacity: number): MaterialHandle {
  const material = new THREE.LineBasicMaterial({
    color: '#6366f1',
    transparent: true,
    opacity,
    blending,
    // Additive strands must not occlude each other or the accumulation the mode exists for never
    // happens. The plain mode leaves it off too, so that a dense figure does not self-occlude into
    // flat silhouette — depth *testing* stays on either way, so a mesh in front still hides them.
    depthWrite: false,
  })

  return {
    material,
    update(params) {
      material.color.set(str(params, 'color', '#6366f1'))
      material.opacity = num(params, 'opacity', opacity)
    },
    dispose: () => material.dispose(),
  }
}

function lineDescriptors(defaultOpacity: number) {
  return [
    matColour('color', 'Colour', '#6366f1'),
    // Reaches well below the mesh materials' usable range: a figure of two hundred crossing strands
    // at full opacity is a solid mass, and the interesting settings are all near the bottom.
    matParam('opacity', 'Opacity', 0.02, 1, defaultOpacity),
  ]
}

export const linesMaterial: MaterialBrick = {
  id: 'mat-lines',
  label: 'Stroke',
  hint: 'Flat colour, one pixel wide. Drawing rather than lighting — a plot, a diagram, a contour.',
  descriptors: lineDescriptors(0.85),
  create: () => lineHandle(THREE.NormalBlending, 0.85),
}

export const linesAdditiveMaterial: MaterialBrick = {
  id: 'mat-lines-additive',
  label: 'Stroke (Additive)',
  hint: 'Strands that add where they cross, so density becomes brightness. Filament, neon, light trails.',
  descriptors: lineDescriptors(0.45),
  create: () => lineHandle(THREE.AdditiveBlending, 0.45),
}

export const LINE_MATERIAL_BRICKS: MaterialBrick[] = [linesMaterial, linesAdditiveMaterial]

/** Is this material meant for line segments?
 *
 *  The one authority, matching `isPointMaterial`. A `LineBasicMaterial` on a mesh renders the mesh
 *  unlit and flat, and a `MeshStandardMaterial` on `THREE.LineSegments` renders black — both look
 *  like a bug rather than a choice, so the picker filters by backend and `buildObject` chooses a
 *  compatible default. */
export function isLineMaterial(id: string): boolean {
  return LINE_MATERIAL_BRICKS.some((brick) => brick.id === id)
}

export const DEFAULT_LINE_MATERIAL_ID = linesAdditiveMaterial.id
