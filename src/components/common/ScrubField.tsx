import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParamDescriptor } from '@/types/params'
import { UNIT_SUFFIX } from '@/utils/units'

interface ScrubFieldProps {
  descriptor: ParamDescriptor
  value: number
  onChange: (value: number) => void
  /** Called once when a drag ends, for undo coalescing (Phase 3F). */
  onCommit?: (value: number) => void
  disabled?: boolean
}

/** Scrubbable numeric field — the primary way any parameter is edited
 *  (docs/05-DESIGN-SYSTEM.md §5.1).
 *
 *  Drag horizontally to scrub with pointer lock, so travel is infinite and the cursor
 *  never hits a screen edge. Shift = 10× coarse, Alt = 0.1× fine. Double-click to type
 *  an exact value.
 *
 *  Range, step, and unit all come from the ParamDescriptor (HC-5) — nothing about a
 *  specific parameter is hardcoded here, so a new brick's parameters get a correct
 *  editor for free. */
export function ScrubField({ descriptor, value, onChange, onCommit, disabled }: ScrubFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const elementRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  // Held in a ref, not state: the pointermove handler must read the live value
  // without re-subscribing on every frame of a drag.
  const liveValue = useRef(value)
  liveValue.current = value

  const decimals = descriptor.step >= 1 ? 0 : descriptor.step >= 0.1 ? 1 : 2

  const clamp = useCallback(
    (raw: number) => Math.min(descriptor.max, Math.max(descriptor.min, raw)),
    [descriptor.min, descriptor.max],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || editing || e.button !== 0) return
      e.preventDefault()
      dragging.current = true
      elementRef.current?.requestPointerLock?.()
    },
    [disabled, editing],
  )

  useEffect(() => {
    if (disabled) return

    const handleMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
      const next = clamp(liveValue.current + e.movementX * descriptor.step * multiplier)
      if (next !== liveValue.current) onChange(next)
    }

    const handleUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (document.pointerLockElement) document.exitPointerLock()
      onCommit?.(liveValue.current)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [clamp, descriptor.step, onChange, onCommit, disabled])

  const commitDraft = () => {
    const parsed = Number.parseFloat(draft)
    if (Number.isFinite(parsed)) {
      const next = clamp(parsed)
      onChange(next)
      onCommit?.(next)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        value={draft}
        // Select the existing value on focus so typing replaces it. Without this,
        // autoFocus leaves the caret mid-string and typing "14" over "0.0" yields
        // "0.014" — the value silently becomes something the user never intended.
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full h-7 px-2 bg-aura-surface border border-aura-focus rounded font-mono tabular-nums text-[11px] text-slate-100 outline-none"
      />
    )
  }

  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      onDoubleClick={() => {
        if (disabled) return
        setDraft(value.toFixed(decimals))
        setEditing(true)
      }}
      title={`${descriptor.label} — drag to scrub, Shift ×10, Alt ×0.1, double-click to type`}
      className={[
        'flex items-center justify-between h-7 px-2 rounded border border-aura-line select-none text-[11px] group',
        disabled
          ? 'bg-aura-base opacity-40 cursor-not-allowed'
          : 'bg-aura-surface hover:bg-aura-elevated cursor-ew-resize',
      ].join(' ')}
    >
      <span className="text-slate-400 font-medium truncate">{descriptor.label}</span>
      <span className="font-mono tabular-nums text-aura-accent group-hover:text-indigo-300 shrink-0">
        {value.toFixed(decimals)}
        {UNIT_SUFFIX[descriptor.unit ?? ''] ?? ''}
      </span>
    </div>
  )
}
