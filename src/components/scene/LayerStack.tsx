import { useState } from 'react'
import {
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Box,
  Lightbulb,
  Spline,
  Waves,
} from 'lucide-react'
import { useSceneStore } from '@/store/useSceneStore'
import { BrickRegistry } from '@/engine/scene/BrickRegistry'
import { brickGroups } from '@/engine/scene/brickGroups'
import { LightRegistry } from '@/engine/scene/lights/LightRegistry'

/** Layer stack — the scene outliner (Figma/Blender model).
 *
 *  One open list for every object type, not fixed primary/secondary shape slots.
 *  Array order is layer order; there is no separate index to fall out of sync. */
export function LayerStack() {
  const objects = useSceneStore((s) => s.objects)
  const selectedId = useSceneStore((s) => s.selectedId)
  const select = useSceneStore((s) => s.select)
  const removeObject = useSceneStore((s) => s.removeObject)
  const duplicateObject = useSceneStore((s) => s.duplicateObject)
  const reorderObject = useSceneStore((s) => s.reorderObject)
  const setVisible = useSceneStore((s) => s.setVisible)
  const setLocked = useSceneStore((s) => s.setLocked)
  const renameObject = useSceneStore((s) => s.renameObject)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ShapeLibrary />

      <header className="px-3 py-2 border-b border-aura-line shrink-0">
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">
          Scene · {objects.length} {objects.length === 1 ? 'object' : 'objects'}
        </h2>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
        {objects.length === 0 && (
          <p className="text-[11px] text-slate-600 text-center py-6 px-3">
            No objects yet. Add a shape above.
          </p>
        )}

        {/* Rendered top-down so the visually topmost row is the last layer, matching
            how Figma and Blender present stacking order. */}
        {[...objects].reverse().map((object) => {
          const index = objects.indexOf(object)
          const isSelected = object.id === selectedId
          const brick = BrickRegistry.get(object.brickId)

          return (
            <div
              key={object.id}
              onClick={() => select(object.id)}
              className={[
                'group flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer border text-[11px] transition-colors',
                isSelected
                  ? 'bg-aura-surface border-aura-accent'
                  : 'border-transparent hover:bg-aura-surface',
              ].join(' ')}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setVisible(object.id, !object.visible)
                }}
                className="text-slate-500 hover:text-slate-200 shrink-0"
                title={object.visible ? 'Hide' : 'Show'}
              >
                {object.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLocked(object.id, !object.locked)
                }}
                className="text-slate-500 hover:text-slate-200 shrink-0"
                title={object.locked ? 'Unlock' : 'Lock'}
              >
                {object.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>

              {renamingId === object.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    renameObject(object.id, draft)
                    setRenamingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renameObject(object.id, draft)
                      setRenamingId(null)
                    }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-aura-base border border-aura-focus rounded px-1 text-[11px] text-slate-100 outline-none"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setDraft(object.name)
                    setRenamingId(object.id)
                  }}
                  className={`flex-1 min-w-0 truncate ${
                    object.visible ? 'text-slate-200' : 'text-slate-600'
                  }`}
                  title={`${object.name} — ${brick?.label ?? object.brickId} (double-click to rename)`}
                >
                  {object.name}
                </span>
              )}

              {object.type === 'light' && (
                <Lightbulb className="w-3 h-3 shrink-0 text-aura-state-solo" />
              )}

              {/* Morph-compatible objects get a marker: it is the difference between
                  "these can transform into each other" and "these can only cut". */}
              {object.type !== 'light' && brick?.morphGroup && (
                <span
                  className="text-[9px] font-mono text-slate-600 shrink-0"
                  title="Morph-compatible — shares the procedural base topology"
                >
                  ◇
                </span>
              )}

              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <IconButton
                  title="Move up"
                  onClick={() => reorderObject(object.id, index + 1)}
                  disabled={index === objects.length - 1}
                >
                  <ChevronUp className="w-3 h-3" />
                </IconButton>
                <IconButton
                  title="Move down"
                  onClick={() => reorderObject(object.id, index - 1)}
                  disabled={index === 0}
                >
                  <ChevronDown className="w-3 h-3" />
                </IconButton>
                <IconButton title="Duplicate" onClick={() => duplicateObject(object.id)}>
                  <Copy className="w-3 h-3" />
                </IconButton>
                <IconButton title="Delete" danger onClick={() => removeObject(object.id)}>
                  <Trash2 className="w-3 h-3" />
                </IconButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={[
        'transition-colors',
        disabled
          ? 'text-slate-700 cursor-default'
          : danger
            ? 'text-slate-500 hover:text-aura-hot'
            : 'text-slate-500 hover:text-slate-200',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Brick picker. Grouped by kind of image, which is the choice actually being made — and the
 *  grouping is shared with the inspector's swap dropdown so the two can never disagree.
 *
 *  Groups fold. With four groups the whole library fitted the panel; with seven it does not, and the
 *  one that fell off the bottom was Lights — a whole element family reachable only by scrolling a
 *  container whose scrollbar you have to find first. Folding the ones you are not using is the
 *  cheapest fix and it stays correct as the SDF and text families land. */
function ShapeLibrary() {
  const addObject = useSceneStore((s) => s.addObject)
  const [folded, setFolded] = useState<Record<string, boolean>>({})

  const groups = [
    ...brickGroups(),
    {
      title: 'Lights',
      hint: 'Intensity and colour are modulation targets — an onset trigger into intensity is a strobe',
      bricks: LightRegistry.list(),
    },
  ]

  return (
    <div className="border-b border-aura-line shrink-0 max-h-[55%] overflow-y-auto">
      {groups.map((group) => (
        <BrickGroup
          key={group.title}
          title={group.title}
          hint={group.hint}
          bricks={group.bricks}
          icon={GROUP_ICONS[group.title] ?? Box}
          folded={folded[group.title] === true}
          onToggle={() => setFolded((f) => ({ ...f, [group.title]: !f[group.title] }))}
          onAdd={addObject}
        />
      ))}
    </div>
  )
}

/** An icon per group. Only where it says something a label does not — the rest share the box. */
const GROUP_ICONS: Record<string, typeof Box> = {
  'Point Clouds': Sparkles,
  Lines: Spline,
  Ribbons: Waves,
}

function BrickGroup({
  title,
  hint,
  bricks,
  onAdd,
  onToggle,
  folded,
  icon: Icon = Box,
}: {
  title: string
  hint: string
  /** Anything with an id and a label — geometry bricks and light bricks alike. */
  bricks: { id: string; label: string }[]
  onAdd: (brickId: string) => void
  onToggle: () => void
  folded: boolean
  icon?: typeof Box
}) {
  return (
    <section className="px-2 pb-2 pt-1.5">
      <button
        onClick={onToggle}
        title={hint}
        aria-expanded={!folded}
        className="w-full flex items-center gap-1 mb-1.5 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform ${folded ? '-rotate-90' : ''}`}
        />
        <span className="truncate">{title}</span>
        <span className="ml-auto font-mono text-slate-600">{bricks.length}</span>
      </button>

      {!folded && (
        <div className="grid grid-cols-3 gap-1">
          {bricks.map((brick) => (
            <button
              key={brick.id}
              onClick={() => onAdd(brick.id)}
              title={`Add ${brick.label}`}
              className="flex flex-col items-center gap-1 py-1.5 rounded bg-aura-surface hover:bg-aura-elevated border border-aura-line hover:border-aura-accent transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[9px] text-slate-400 truncate max-w-full px-1">
                {brick.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
