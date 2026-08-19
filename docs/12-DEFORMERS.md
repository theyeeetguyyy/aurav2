# 12 — Deformer Catalogue

> *"Deformer might be one true great thing we have."* Agreed. This is the reference for
> what exists, why each one is structurally different, and the rule they all obey.

## The rule: deformers cannot animate themselves (D-36)

`DeformContext` has **no `time`**. A deformer is a pure function of its parameters.

Anything that moves, moves because a Field is driving it — a stem, an LFO, a Generator.

The first version got this wrong: `Noise Wave` and `Wave` had a `speed` parameter and
animated on their own. That produced motion the user never asked for, could not switch
off, and could not sync to anything. Both now expose **`phase`** instead, and a saw LFO
wired to it gives the same travel — but authored, sync-able, and visible in the patch.

Removing `time` from the contract makes this structural rather than a convention someone
forgets. `deformers.test.ts` asserts it, so reintroducing built-in motion means arguing
with the test rather than quietly slipping it back in.

**Consequence:** with the transport paused, everything is still. That is correct — it is
the same property that makes preview identical to export (HC-3).

## Why displacement, not geometry parameters

A geometry parameter like `radius` **rebuilds the mesh**; wiring a kick to it would
re-tessellate 642 vertices 60 times a second and grow the geometry cache without bound.
So geometry params are `realtime: false` and never appear as routing targets (D-31).

A deformer **displaces an already-built mesh**. That is why it can be driven at frame
rate, and why deformers — not geometry settings — are where audio-reactive shape change
lives.

Implementation is CPU whole-array passes over a per-object working copy, normals
recomputed each frame (D-33). Shared geometry is never mutated: an object with an active
stack gets a private copy, one without allocates nothing.

---

## The twenty

Each is a different **class** of vertex operation, not a variation on one. That is the
selection criterion — a deformer that is "explode but slightly different" earns nothing,
because the value is in how they *combine*.

| # | Deformer | Class | What it does | Wire it to |
|---|---|---|---|---|
| 1 | **Explode** | radial, uniform | Vertices burst along their original normals, with fixed per-vertex shard jitter | Kick onset trigger |
| 2 | **Spike / Protrude** | axial, concentrated | Elongates along an axis; Sharpness narrows it from bulge to needle | Guns / transients |
| 3 | **Noise Wave** | field-based | Organic turbulence sampled from a 3D noise field | Amount ← sub-bass, Phase ← saw LFO |
| 4 | **Twist** | angular, along axis | Rotation grows *along* an axis — corkscrew shear | Sustained pads |
| 5 | **Vortex** | angular, by radius | Rotation falls off *with distance from* the axis — whirlpool. The inverse structure of Twist | Slow LFO |
| 6 | **Wave** | periodic, planar | Sine ripple across an axis | Phase ← saw LFO for travel |
| 7 | **Shockwave** | distance ring | Gaussian band of displacement at a given radius | Radius ← envelope, for a blast front |
| 8 | **Fracture** | cellular, rigid | Quantises position into cells; each cell flies apart as a rigid chunk with its own spin | Kick, hard hits |
| 9 | **Melt** | gravitational | Sags downward and pools outward at a floor. The only asymmetric one | Slow envelope, breakdowns |
| 10 | **Bend** | coordinate warp | Curls the whole shape around an arc — a space warp, not a displacement | Slow LFO |
| 11 | **Bulge / Pinch** | banded radial | Fattens or squeezes a Gaussian band | Bass |
| 12 | **Squash & Stretch** | coupled axes | Volume-preserving: squash one axis, the others fatten. The bounce primitive | Kick envelope |
| 13 | **Quantize** | discretisation | Snaps vertices to a grid, blended. Digital and blocky | Amount ← a build-up |
| 14 | **Attract / Repel** | point field | Pulls toward or pushes from a movable point, Gaussian falloff | Point position ← LFOs, to drag the shape around |
| 15 | **Spherify** | normalisation | Rounds toward a sphere; negative exaggerates the silhouette | Anything — it is the "resolve" deformer |
| 16 | **Dissolve** | subtractive | The only one that REMOVES rather than moves. Vertices past a threshold collapse to the centre, making their triangles degenerate and therefore invisible. Scatter sweeps between a clean wipe along an axis and a scattered erosion | Amount ← a build-up, for a shape that disintegrates into the drop |
| 17 | **Taper** | proportional | Scales the cross-section along an axis. The only one that changes a shape's *proportions* — cylinder to cone, sphere to teardrop | Slow envelope |
| 18 | **Mirror** | space folding | Reflects one half of the shape onto the other. Asks which side of a plane a vertex is on rather than where to move it, so the silhouette changes *shape*. Offsetting the plane cuts the form somewhere it was not designed to be cut | Amount ← a build-up |
| 19 | **Ocean** | trochoidal | Gerstner waves. Points move in circles rather than up and down, so material piles into sharp crests with flat troughs between — the horizontal term is the whole effect and no setting of **Wave** reproduces it | Travel ← saw LFO |
| 20 | **Shatter** | cellular, irregular | Voronoi cells from scattered seeds, where **Fracture** uses an axis-aligned grid. Same gesture, different material: grid gives blocks and reads digital, seeds give shards and read as glass | Kick, hard hits |

### One that was written and deleted

**Relax** — a smoothing deformer, to stack after chaos and regain control of a silhouette. Without
neighbour adjacency the only thing it could do was pull vertices toward a **mean radius**, which is
Spherify with the radius computed rather than typed. The selection criterion above is not decoration:
a catalogue whose premise is that every entry is a distinct class is worth *less* for holding a
near-duplicate. A true Laplacian relax needs adjacency the shared topology could provide and does not
expose — real work, not twenty lines, and worth doing properly when it is worth doing.

### Distinctions worth knowing

- **Fracture vs. Shatter.** Both break the surface into rigid chunks; the difference is the
  break *pattern*, and the pattern is the point. Fracture quantises position onto an axis-aligned
  grid, so the pieces are blocks and it reads as digital collapse. Shatter assigns each vertex to
  its nearest of N scattered seeds, so the pieces are irregular shards and it reads as glass or
  stone. Neither is a setting of the other.
- **Wave vs. Ocean.** Wave is a vertical sine — round, symmetric humps. Ocean adds the horizontal
  term that makes water water: points travel in circles, material gathers at the crest, and the
  troughs flatten out. Turning Wave's amplitude up gives taller humps, never peaks.
- **Explode vs. Fracture.** Explode moves every vertex independently, so the mesh
  stretches. Fracture groups neighbours into cells and moves each cell as a rigid unit,
  so the mesh reads as *broken*. Different look, different maths.
- **Twist vs. Vortex.** Twist's rotation grows with distance *along* the axis. Vortex's
  falls off with distance *from* it. Same primitive, opposite structure.
- **Bend vs. Twist.** Twist rotates in the plane *perpendicular* to its axis. Bend
  rotates in the plane *containing* it, so a straight form becomes an arc.
- **Bulge vs. Squash.** Bulge scales a band; Squash scales the whole object with volume
  conserved. Only Squash reads as elastic.

## Stacking

Order is evaluation order, and it matters — `Twist → Explode` is not `Explode → Twist`.
Every frame restarts from the undisplaced mesh, so the stack is a function of parameters
rather than of frame history.

Some combinations worth trying:

| Recipe | Stack |
|---|---|
| **Shattering pulse** | Fracture (Amount ← kick trigger) + Spherify (small, to hold the silhouette) |
| **Breathing organism** | Noise Wave (Phase ← slow saw) + Bulge (← bass) |
| **Liquid metal** | Melt + Spherify (negative) + high metalness |
| **Digital collapse** | Quantize (Amount ← build-up) + Explode (← drop) |
| **Rubber ball** | Squash & Stretch (← kick envelope), nothing else |

## Generators — where motion comes from

Because deformers cannot self-animate, anything that should move on its own is driven by
a **Generator**: a synthetic stem that lives in the patchbay's source column alongside
imported audio.

Types: sine · triangle · saw · square · noise · random-walk.
Per generator: rate (Hz), phase offset, depth, bias, pulse width.

They are first-class and multiple by design — "a slow sine for the background drift" and
"a fast saw for the strobe" are two different sources you can name, not one shared LFO
reconfigured per connection.

- **Saw → Phase** on Wave or Noise gives continuous travel.
- **Sine → Attract point** drags the deformation around the surface.
- **Random-walk → anything** gives drift that never settles into a visible rhythm.

## Adding a deformer

```ts
{
  id: 'def-something',
  label: 'Something',
  family: 'geometry',
  hint: 'One line shown in the picker.',
  descriptors: [deformParam('amount', 'Amount', -20, 20, 0)],
  apply({ positions, base, directions, vertexCount, params }) { /* … */ },
}
```

Then add it to `DEFORMER_BRICKS`. Registration is data — no switch statement anywhere
knows about it, and it becomes a modulation target automatically.

Requirements the tests enforce:

1. **Inert at defaults.** Adding one to look at its controls must not change the shape.
2. **Deterministic.** Same parameters, same geometry, every time.
3. **At least one `realtime: true` exposed parameter** — otherwise it is not a deformer.
4. **Allocation-free** in `apply`. It runs every frame for every object.
