# 11 — Routing UX

> **The complaint:** *"the flow to use it is click click click… I am thinking like
> TouchDesigner, that will be more user friendly."*
>
> Diagnosis agreed, prescription partly disagreed. Reasoning below.

## What is actually wrong today

Connecting one stem to one parameter costs **five interactions**:

```
click +  →  dropdown (field)  →  dropdown (stem)  →  maybe checkbox  →  click Connect
```

Three deeper problems than the click count:

1. **No overview.** You cannot see the patch. Connections hide inside collapsed rows, so
   "what is driving this scene?" has no answer without expanding everything.
2. **No spatial memory.** Every connection looks identical in a flat list. Nothing to
   point at, nothing to recognise.
3. **Direction is invisible.** A modulation *flows* from a source to a target. A list of
   rows communicates none of that.

Those are the real failures. Click count is a symptom.

## Where TouchDesigner is right, and where it is wrong for AURA

**Right:** wires. Seeing a line from source to destination, with signal visibly moving
along it, is why a patcher feels alive and a list feels dead. That is worth copying and
this document adopts it.

**Wrong for the default view:** a free-form canvas of draggable nodes. TouchDesigner's
own most-cited weakness is its learning curve, and Principle 2 (from Niagara) plus
Principle 9 (from Resolume) both say the same thing — the primary surface should require
no patching. A blank canvas also brings costs with no benefit here:

- Node positions become project state to lay out, save, migrate and auto-arrange
- With 8 stems × 13 metrics the source side alone is 104 potential nodes
- Spaghetti is a *known* TouchDesigner failure mode, not a bonus feature

**So: take the wires, drop the free canvas.** There is a shape that gives both.

---

## The design — Patchbay

A **fixed two-column patchbay** with a live wire layer between. Not a list, not a canvas.
The mental model producers already own: a studio patch panel.

```
┌──────────────────────┬─────────────┬────────────────────────────────┐
│  SOURCES             │   WIRES     │  TARGETS                       │
│                      │             │                                │
│  ▸ Drums             │      ╭──────┼─▸ Sphere                       │
│    ● Envelope   ─────┼──────╯      │    ├ Scale          ◀━━━ 2      │
│    ● Onset      ─────┼───────╮     │    ├ Position Y                │
│    ● Band · Sub ─────┼────╮  ╰─────┼─▸  ├ Rotation Y                │
│    ● Brightness      │    │        │    ╰ Explode · Strength ◀━ 1   │
│                      │    │        │                                │
│  ▸ Guns              │    ╰────────┼─▸ Cube                         │
│    ● Onset      ─────┼─────────────┼─▸  ╰ Spike · Amount     ◀━ 1   │
│                      │             │                                │
│  ▸ Generative        │             │                                │
│    ● LFO Sine        │             │                                │
└──────────────────────┴─────────────┴────────────────────────────────┘
```

### The core gesture

**Drag a source dot onto a target row.** One gesture, done.

- Press on a source dot → a wire follows the cursor
- Every compatible target highlights; incompatible ones dim
- Release on a target → connected, wire animates in
- Release on empty space → cancelled

That is 1 interaction instead of 5, and it is the same gesture NeuralFrames uses (drag a
stem onto a property) — the one piece of that product's UX worth stealing.

### Wires carry information

| Channel | Meaning |
|---|---|
| **Colour** | Source family — audio orange, rhythm green, generative blue, event rose (design system §3.3) |
| **Thickness** | Connection weight |
| **Brightness pulse** | The live signal value, animated at frame rate |
| **Dashed** | Discrete trigger rather than continuous |
| **Dimmed** | Disabled |

The pulse matters more than it sounds. A wire that visibly throbs on every kick answers
"is this actually working?" without pressing play and squinting at a shape. Idea is from
Cables.gl, already noted in the original knowledge base and never acted on.

**Rendered as one SVG overlay, animated imperatively** off `TransportClock` — never React
state (HC-1). Same discipline as the waveform playhead.

### Editing a wire

- **Click** → selects; chain editor (Gain / Rise / Fall / Min / Max / Weight) opens in the right dock
- **Drag its target end** → re-target to another parameter
- **Drag off** → delete
- **Double-click** → toggle enabled

No dialog, no confirm step.

### Removing the remaining decisions

The current flow asks two questions at connect time. Both can be inferred:

- **Which stem?** — you dragged from a specific stem's dot. Answered by the gesture.
- **Continuous or discrete?** — `onset` sources default to **discrete**, everything else
  to **continuous**, because that is right ~95% of the time. Switchable afterwards in the
  chain editor. A percussive source wants fire-once; a sustained one wants a blend
  (Principle 4) — the source already implies the answer.

### Sensible defaults on drop

A fresh connection should visibly do something, or the first experience is "I wired it
and nothing happened". On connect, seed `min`/`max` from the target descriptor's range —
roughly ±25% of it — rather than the current flat `0 → 1`, which is nearly invisible on a
parameter whose range is −500…500.

---

## Node graph — what it is actually for

Phase 5C. Not a second routing UI — the patchbay already routes. The node graph is a
**signal-processing environment**: it exists for the things a one-hop source→target wire
structurally cannot express.

### The four things the patchbay cannot do

1. **Maths between two signals.** The patchbay sums weighted contributions at the target.
   Sum is the only operator available. There is no way to express *drums minus sub*, or
   *guns × LFO*, or *max(kick, snare)*.
2. **Shape once, fan out.** Driving five parameters from the same shaped envelope means
   five connections and five chains to keep in sync. A graph shapes once and branches.
3. **Object-to-object** (5E). "Shape B answers Shape A" is a dependency chain, not two
   columns. It needs evaluation order and cycle detection.
4. **Reusable sub-patches.** "My kick reaction" as a named, saved unit droppable into any
   project — which is the rig business model in miniature (§4.7).

### Node catalogue

| Family | Nodes |
|---|---|
| **Source** | Stem metric · Rhythm · Generator · Object parameter · Section |
| **Math** | Add · Subtract · Multiply · Min · Max · Abs · Invert · Clamp · Remap · Mix(a, b, t) |
| **Shape** | Curve · Quantize · Slew · Sample & Hold · Peak Hold · Threshold · Compare |
| **Time** | Delay · Time-scale · Beat-sync |
| **Logic** | If/Else · Section-is · Gate-by |
| **Utility** | Macro (group) · Scope (inline meter) · Comment |
| **Output** | Parameter target |

> **Delay is free here, and that is not a small thing.** Because features are timelines
> sampled by `t` (HC-3), a delay node is `sample(t − d)` — no ring buffer, no state, and
> still deterministic under scrubbing and out-of-order export. In a live-tap architecture
> a delay node needs history and immediately breaks export. Same for time-scale and
> look-ahead.

### What you would actually build with it

| Patch | Graph |
|---|---|
| **Sidechain duck** | `atmosphere.brightness − (kick.envelope × 0.8) → bloom` |
| **Difference** | `drums − sub → explode` — reacts to what is in the drums but *not* the 808 |
| **Ring mod** | `guns.onset × lfo.saw → spike.amount` |
| **Cascade** | one envelope, `delay` per clone → a wave travelling across a cloner array |
| **Stepped motion** | `envelope → quantize(1/8) → rotation` — mechanical instead of fluid |
| **Random on hit** | `kick.onset → sample&hold(noise) → colour.hue` — a new colour each kick |
| **Call and response** | `sphereA.scale → delay(0.25) → sphereB.scale` (needs 5E) |
| **Section-aware** | `if section == drop then drums else lfo → deformer` — the brief's "story/tension" made concrete |

That last row is the one worth noticing: **the node graph is where "musicians show story,
tension, call and response" stops being philosophy** and becomes a patch you can build.

### Same data, two views

Toggle in the page header: `Patchbay ⟷ Graph`. A patchbay wire *is* a graph — source →
chain → target — so opening the graph shows the existing patch already laid out, and a
graph with no processor nodes displays perfectly well as a patchbay. Neither is a mode
(Principle 2, Niagara's stack/graph duality).

Node positions are the one piece of state only the graph has. Auto-laid-out on first open,
saved thereafter.

### Why it is deliberately not next

The patchbay covers the large majority of real routing, and every item in Tier 1 of
[13-PRODUCT-GAP.md](13-PRODUCT-GAP.md) — save/load, undo, timeline, export — costs the
user more than this does. The graph also gets substantially better *after* the timeline
exists, because section-conditional nodes need markers to condition on.

Build it when a patch you actually want becomes impossible, not before.

---

## Why not just improve the list

Because the list is the wrong shape for the information. Modulation is a *directed
graph*; a list flattens direction away. Every fix to the list — inline dropdowns, better
grouping, fewer clicks — leaves the three real problems untouched.

Per the standing instruction that rewriting is allowed: `StackedRoutingList.tsx` is
replaced, not extended. The engine underneath (`ModulationMatrix`, `SignalShaper`,
`fields`, `useModulationStore`) is unaffected — it was built with no opinion about the UI,
which is exactly why this swap is cheap. `ChainEditor` survives and moves to the right dock.

---

## Implementation plan

| Step | Work |
|---|---|
| 11A | `SourceColumn` — stems grouped, metric dots, generative/rhythm groups |
| 11B | `TargetColumn` — objects grouped, parameters incl. deformer params, drop zones |
| 11C | `WireLayer` — SVG beziers from measured DOM anchors, `ResizeObserver` + scroll-aware |
| 11D | Drag-to-connect with live cursor wire and target highlighting |
| 11E | Live pulse animation off `TransportClock`, imperative |
| 11F | Wire selection, re-target, delete; `ChainEditor` in right dock |
| 11G | Descriptor-seeded default range on connect |
| 11H | Keep the scene monitor visible throughout |
| 11I | Resizable columns — both sides drag independently, gutter takes the remainder |

Scene monitor stays pinned. Wiring while watching the result is the whole point.

**Test:** connect drums-envelope to sphere scale in **one drag**. Wire pulses on every
kick. Drag its end onto Explode · Strength and it re-targets. The full patch is legible
without expanding anything.
