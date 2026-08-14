import { BrickRegistry } from './BrickRegistry'
import { RIBBON_BRICKS } from './backends/ribbonMesh'
import type { GeometryBrick } from './backends/types'

/** How the geometry catalogue is divided for a human.
 *
 *  One home for the grouping, because two components need exactly the same one: the library in the
 *  layer stack, where a shape is chosen, and the swap dropdown in the inspector, where it is
 *  changed. They had drifted apart once already — the library filtered by backend and the dropdown
 *  by `meshKind`, so a point brick appeared under "Morphable" in one of them.
 *
 *  The divisions are by **kind of image**, not by implementation: a ribbon is a triangle mesh like a
 *  primitive, but what a user is choosing between is a solid, a cloud, a stroke and a swept path. */

export interface BrickGroup {
  title: string
  hint: string
  bricks: GeometryBrick[]
}

const RIBBON_IDS = new Set(RIBBON_BRICKS.map((brick) => brick.id))

export function brickGroups(): BrickGroup[] {
  const bricks = BrickRegistry.list()
  const isRibbon = (brick: GeometryBrick) => RIBBON_IDS.has(brick.id)

  return [
    {
      title: 'Morphable',
      hint: 'One shared topology — any of these can morph into any other',
      bricks: bricks.filter((b) => b.backend === 'mesh' && b.meshKind === 'procedural'),
    },
    {
      title: 'Primitives',
      hint: 'True topology and UVs — swap only, no vertex morph',
      bricks: bricks.filter(
        (b) => b.backend === 'mesh' && b.meshKind === 'primitive' && !isRibbon(b),
      ),
    },
    {
      title: 'Point Clouds',
      hint: 'Not surfaces — every deformer works on them, and density reads as brightness',
      bricks: bricks.filter((b) => b.backend === 'points'),
    },
    {
      title: 'Lines',
      hint: 'Pure trajectory, one pixel wide — additive strands brighten where they cross',
      bricks: bricks.filter((b) => b.backend === 'lines'),
    },
    {
      title: 'Ribbons',
      hint: 'The same paths as the lines, with a section swept along — real meshes that light and cast shadows',
      bricks: bricks.filter(isRibbon),
    },
  ]
}
