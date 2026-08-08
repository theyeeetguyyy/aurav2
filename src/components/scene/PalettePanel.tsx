import { Check } from 'lucide-react'
import { STARTER_PALETTES } from '@/engine/scene/palette'
import { useSceneStore } from '@/store/useSceneStore'

/** The scene's colours.
 *
 *  Top of the Look page, above everything, because the palette is upstream of every other decision
 *  on it — the background, the rig and every material read against it.
 *
 *  Objects bind to a *slot*, so re-picking a palette recolours the whole scene at once. That is the
 *  edit people want and it previously meant visiting every object; it is also why this is a scene
 *  control rather than a per-object one. */
export function PalettePanel() {
  const palette = useSceneStore((s) => s.palette)
  const objects = useSceneStore((s) => s.objects)
  const setPalette = useSceneStore((s) => s.setPalette)
  const setPaletteColor = useSceneStore((s) => s.setPaletteColor)
  const setPaletteBackground = useSceneStore((s) => s.setPaletteBackground)

  /** How many shapes each slot currently colours, so the swatch says what editing it will move. */
  const usage = palette.colors.map(
    (_, slot) =>
      objects.filter(
        (o) =>
          o.paletteSlot !== null &&
          ((o.paletteSlot % palette.colors.length) + palette.colors.length) %
            palette.colors.length ===
            slot,
      ).length,
  )

  const active = STARTER_PALETTES.find(
    ({ palette: candidate }) =>
      candidate.colors.join() === palette.colors.join() &&
      candidate.background === palette.background,
  )

  return (
    <section className="border-b border-aura-line">
      <header className="flex items-center gap-1.5 px-2 py-1.5">
        <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">Palette</h3>
        {active && <span className="text-[9px] text-slate-600">{active.name}</span>}
      </header>

      <div className="px-2 pb-2 space-y-2">
        {/* Starters, as swatch rows. A row of colours is the control — a dropdown of names would
            make you pick a palette without seeing it. */}
        <div className="space-y-1">
          {STARTER_PALETTES.map(({ name, palette: candidate }) => {
            const current = active?.name === name
            return (
              <button
                key={name}
                onClick={() => setPalette(candidate)}
                title={name}
                className={`w-full flex items-center gap-1.5 h-6 px-1 rounded border transition-colors ${
                  current ? 'border-aura-accent' : 'border-transparent hover:border-aura-line'
                }`}
              >
                <span className="w-3 shrink-0">
                  {current && <Check className="w-3 h-3 text-aura-accent" />}
                </span>
                <span
                  className="w-3 h-3.5 shrink-0 rounded-sm border border-black/40"
                  style={{
                    background: `linear-gradient(${candidate.backgroundEnd}, ${candidate.background})`,
                  }}
                />
                <span className="flex-1 flex h-3.5 rounded-sm overflow-hidden">
                  {candidate.colors.map((colour, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: colour }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        {/* The live palette, editable. Native colour inputs: the OS picker is better than anything
            worth building here, and it is the control people already know. */}
        <div className="flex items-center gap-1">
          {palette.colors.map((colour, slot) => (
            <label
              key={slot}
              className="relative flex-1"
              title={`Slot ${slot + 1} — ${usage[slot]} object${usage[slot] === 1 ? '' : 's'}`}
            >
              <input
                type="color"
                value={colour}
                onChange={(e) => setPaletteColor(slot, e.target.value)}
                aria-label={`Palette slot ${slot + 1}`}
                className="w-full h-7 bg-transparent border border-aura-line rounded cursor-pointer"
              />
              {usage[slot] > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-aura-base border border-aura-line text-[8px] font-mono leading-[13px] text-center text-slate-400">
                  {usage[slot]}
                </span>
              )}
            </label>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 w-16 shrink-0">Background</span>
          <input
            type="color"
            value={palette.background}
            onChange={(e) => setPaletteBackground(e.target.value, palette.backgroundEnd)}
            aria-label="Background bottom"
            className="flex-1 h-6 bg-transparent border border-aura-line rounded cursor-pointer"
          />
          <input
            type="color"
            value={palette.backgroundEnd}
            onChange={(e) => setPaletteBackground(palette.background, e.target.value)}
            aria-label="Background top"
            className="flex-1 h-6 bg-transparent border border-aura-line rounded cursor-pointer"
          />
        </div>
      </div>
    </section>
  )
}
