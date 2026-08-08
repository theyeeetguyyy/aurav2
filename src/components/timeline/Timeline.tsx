import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Magnet, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { SNAP_WINDOW_PIXELS, snapToGrid } from '@/engine/timeline/StateResolver'
import { TransportClock } from '@/engine/time/TransportClock'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { projectDuration, useAudioStore } from '@/store/useAudioStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useUIStore } from '@/store/useUIStore'
import {
  DEFAULT_SECTION_TYPE,
  SECTION_TYPES,
  TIMELINE_LANES,
  type SectionMarker,
  type Strip,
} from '@/types/project'
import { readToken } from '@/utils/tokens'

/** The NLE timeline (docs/06-ROADMAP.md 6B).
 *
 *  Strips reference states (HC-7), so dragging one never copies anything — and editing a
 *  state updates every placement of it at once. Lanes layer like an image editor: a higher
 *  lane wins a conflict, which is how a drop state sits on top of a persistent background.
 *
 *  The playhead is drawn imperatively from `TransportClock` (HC-1) — it moves every frame
 *  and must not enter React's render path.
 *
 *  Snapping is to the **detected beat grid** plus every section marker, not to a fixed
 *  subdivision: the grid comes from the analyser, so "put this cut on the drop" is a drag
 *  that lands rather than a number anyone has to compute. */

const LANE_HEIGHT = 34
const RULER_HEIGHT = 22

type Drag =
  | { kind: 'move'; stripId: string; grabOffset: number }
  | { kind: 'resize-start'; stripId: string }
  | { kind: 'resize-end'; stripId: string }

export function Timeline() {
  const project = useProjectStore((s) => s.project)
  const placeStrip = useProjectStore((s) => s.placeStrip)
  const updateStrip = useProjectStore((s) => s.updateStrip)
  const removeStrip = useProjectStore((s) => s.removeStrip)
  const placeMarker = useProjectStore((s) => s.placeMarker)
  const removeMarker = useProjectStore((s) => s.removeMarker)
  const updateMarker = useProjectStore((s) => s.updateMarker)

  const tracks = useAudioStore((s) => s.tracks)
  // Floored at one second so an empty project still has a ruler to look at rather than a
  // zero-width strip of nothing.
  const duration = useMemo(() => Math.max(1, projectDuration(tracks)), [tracks])

  const [pxPerSecond, setPxPerSecond] = useState(40)
  const [snap, setSnap] = useState(true)
  const [selectedStripId, setSelectedStripId] = useState<string | null>(null)
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null)

  // A constant pixel reach means the snap feels identical at every zoom level.
  const tolerance = snap ? SNAP_WINDOW_PIXELS / pxPerSecond : 0

  const setActivePage = useUIStore((s) => s.setActivePage)

  const seek = (time: number) => MultiTrackRack.getInstance().seek(time)

  const laneRef = useRef<HTMLDivElement>(null)
  /** Zoom target, applied after the DOM has the new width. Zooming around the pointer needs
   *  the scroll position and the new scale at once, and only one of them exists during
   *  render. */
  const anchor = useRef<{ time: number; offsetX: number } | null>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  const states = Object.values(project.statesLibrary)

  // Both selections are resolved against the project rather than trusted, so deleting a
  // state or the strip it backs cannot leave a button pointing at something that is gone.
  const selectedStrip = project.timelineStrips.find((st) => st.id === selectedStripId) ?? null
  // Falling back to the first state means double-clicking a lane always places something.
  // Requiring a selection first is a silent no-op, and a silent no-op reads as broken.
  const activeState =
    (selectedStateId && project.statesLibrary[selectedStateId]) || states[0] || null

  /** What a drag snaps to: the first stem that reports a beat grid, plus every marker.
   *  Stems in one beat share a tempo, so taking the first that has one is correct and cheap. */
  const grid = useMemo(() => {
    const beats: number[] = []
    for (const track of tracks) {
      const detected = AudioFeatures.getBeatGrid(track.id)
      if (detected.length > 0) {
        beats.push(...detected)
        break
      }
    }
    // Markers join the grid. A moment someone bothered to name is the moment they most want
    // to cut on, and it should pull just as hard as a beat — more usefully so, because it
    // still works when the detector guessed the tempo wrong.
    for (const marker of project.markers) beats.push(marker.time)
    return beats
  }, [tracks, project.markers])

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const lane = laneRef.current
      if (!lane) return 0
      const box = lane.getBoundingClientRect()
      return Math.max(0, (clientX - box.left + lane.scrollLeft) / pxPerSecond)
    },
    [pxPerSecond],
  )

  // Keep whatever was under the pointer under the pointer. A zoom that drifts means
  // hunting for the bar you were looking at after every wheel notch.
  useEffect(() => {
    const target = anchor.current
    const lane = laneRef.current
    if (!target || !lane) return
    anchor.current = null
    lane.scrollLeft = target.time * pxPerSecond - target.offsetX
  }, [pxPerSecond])

  const zoom = useCallback(
    (factor: number, clientX?: number) => {
      const lane = laneRef.current
      if (lane && clientX !== undefined) {
        const offsetX = clientX - lane.getBoundingClientRect().left
        anchor.current = { time: (offsetX + lane.scrollLeft) / pxPerSecond, offsetX }
      } else {
        // Cleared, not left alone. A wheel notch at the zoom limit sets an anchor that the
        // effect never consumes, and a later button zoom would jump to it.
        anchor.current = null
      }
      setPxPerSecond((p) => Math.min(400, Math.max(4, p * factor)))
    },
    [pxPerSecond],
  )

  // Playhead, imperative.
  useEffect(() => {
    const line = playheadRef.current
    if (!line) return
    const apply = (time: number) => {
      line.style.transform = `translateX(${time * pxPerSecond}px)`
    }
    apply(TransportClock.time)
    return TransportClock.subscribe(apply)
  }, [pxPerSecond])

  // Drag is global rather than per-strip: the pointer routinely leaves the strip it
  // grabbed, and a listener on the strip would drop the gesture the moment it did.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const active = drag.current
      if (!active) return

      const strip = useProjectStore
        .getState()
        .project.timelineStrips.find((s) => s.id === active.stripId)
      if (!strip) return

      const time = timeFromClientX(event.clientX)

      if (active.kind === 'move') {
        updateStrip(strip.id, {
          startTime: snapToGrid(time - active.grabOffset, grid, tolerance),
        })
      } else if (active.kind === 'resize-start') {
        const end = strip.startTime + strip.duration
        const start = Math.min(snapToGrid(time, grid, tolerance), end - 0.1)
        updateStrip(strip.id, { startTime: start, duration: end - start })
      } else {
        const end = Math.max(snapToGrid(time, grid, tolerance), strip.startTime + 0.1)
        updateStrip(strip.id, { duration: end - strip.startTime })
      }
    }

    const onUp = () => {
      drag.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [grid, tolerance, timeFromClientX, updateStrip])

  // Covers the furthest strip as well as the audio: a strip dragged past the last stem must
  // stay reachable rather than being clipped outside the scroll extent.
  const contentSeconds = project.timelineStrips.reduce(
    (max, st) => Math.max(max, st.startTime + st.duration),
    duration,
  )
  const width = Math.max(600, contentSeconds * pxPerSecond)

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="flex items-center gap-1.5 px-3 py-1.5 border-b border-aura-line shrink-0">
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">Timeline</h2>

        <button
          onClick={() => setSnap((v) => !v)}
          title={
            grid.length === 0
              ? 'Nothing to snap to yet — import a stem with a clear tempo, or press M to mark a moment'
              : snap
                ? 'Snapping to the detected beat grid'
                : 'Free placement'
          }
          className={`flex items-center gap-1 h-6 px-1.5 rounded border text-[10px] transition-colors ${
            snap && grid.length > 0
              ? 'border-aura-accent text-aura-accent'
              : 'border-aura-line text-slate-500 hover:text-slate-300'
          }`}
        >
          <Magnet className="w-3 h-3" />
          {grid.length > 0 ? 'Beat' : 'No grid'}
        </button>

        <div className="flex items-center">
          <IconButton title="Zoom out (Ctrl + wheel)" onClick={() => zoom(1 / 1.5)}>
            <ZoomOut className="w-3 h-3" />
          </IconButton>
          <IconButton title="Zoom in (Ctrl + wheel)" onClick={() => zoom(1.5)}>
            <ZoomIn className="w-3 h-3" />
          </IconButton>
        </div>

        {project.bpm !== null && (
          <span
            className="text-[10px] font-mono tabular-nums text-slate-600"
            title="Detected tempo — the beat grid strips snap to"
          >
            {Math.round(project.bpm)} BPM
          </span>
        )}

        <span className="flex-1" />

        {selectedStrip && (
          <button
            onClick={() => {
              removeStrip(selectedStrip.id)
              setSelectedStripId(null)
            }}
            className="flex items-center gap-1 h-6 px-1.5 rounded border border-aura-line text-[10px] text-slate-400 hover:text-aura-hot transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Delete strip
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ─── State library ─── */}
        <aside className="w-52 shrink-0 border-r border-aura-line flex flex-col min-h-0">
          <div className="flex items-center gap-1.5 px-2 py-1.5 shrink-0">
            <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">States</h3>
            <button
              onClick={() => setActivePage('scene-shapes')}
              title="States are built on Scene & Shapes"
              className="text-[9px] text-slate-600 hover:text-aura-accent transition-colors"
            >
              build →
            </button>
          </div>



          <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1">
            {states.length === 0 && (
              <p className="text-[10px] text-slate-600 leading-snug px-0.5">
                No states yet. Build one on Scene &amp; Shapes — a state is the scene plus its
                routing — then place it here and cut between them.
              </p>
            )}

            {states.map((state) => (
              <div
                key={state.id}
                onClick={() => setSelectedStateId(state.id)}
                className={`px-1.5 py-1 rounded border cursor-pointer transition-colors ${
                  activeState?.id === state.id
                    ? 'border-aura-accent bg-aura-surface'
                    : 'border-transparent hover:bg-aura-surface'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: state.color }}
                  />
                  <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">
                    {state.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStripId(
                        placeStrip(state.id, TransportClock.time, Math.max(2, duration / 8)),
                      )
                    }}
                    title="Place it at the playhead"
                    className="shrink-0 h-[18px] px-1.5 rounded border border-aura-accent text-[10px] leading-none text-aura-accent hover:bg-aura-surface transition-colors"
                  >
                    Place
                  </button>
                </div>

                <p className="text-[9px] text-slate-600 mt-0.5 font-mono tabular-nums">
                  {state.objects.length} obj · {state.connections.length} wire
                  {state.connections.length === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>

          {/* ─── Section markers ─── */}
          {/* Sized to its content up to a third of the rail. States is the primary list and
              keeps the rest — it had been squeezed to about four lines. */}
          <div className="border-t border-aura-line flex flex-col min-h-0 max-h-[33%] shrink-0">
            <div className="flex items-center gap-1 px-2 py-1.5 shrink-0">
              <h3 className="flex-1 text-[10px] uppercase tracking-wider text-slate-500">
                Sections
              </h3>
              <button
                onClick={() => placeMarker(TransportClock.time, DEFAULT_SECTION_TYPE)}
                title="Mark this moment (M)"
                className="text-slate-500 hover:text-aura-accent transition-colors"
              >
                <Flag className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-0.5">
              {project.markers.length === 0 && (
                <p className="text-[10px] text-slate-600 leading-snug px-0.5">
                  Press M while it plays to mark the drop. Snap to them, jump between them.
                </p>
              )}

              {project.markers.map((marker) => (
                <div key={marker.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => seek(marker.time)}
                    title="Jump here"
                    className="w-9 shrink-0 text-left text-[9px] font-mono tabular-nums text-slate-500 hover:text-aura-accent transition-colors"
                  >
                    {formatTime(marker.time)}
                  </button>

                  <select
                    value={marker.type}
                    onChange={(e) =>
                      updateMarker(marker.id, {
                        type: e.target.value as SectionMarker['type'],
                        label: e.target.value,
                      })
                    }
                    aria-label={`Section type at ${formatTime(marker.time)}`}
                    className="flex-1 min-w-0 h-5 bg-transparent border border-transparent hover:border-aura-line rounded text-[10px] text-slate-300 outline-none focus:border-aura-focus"
                  >
                    {SECTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => removeMarker(marker.id)}
                    title="Delete marker"
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-aura-hot transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── Lanes ─── */}
        <div
          ref={laneRef}
          onWheel={(e) => {
            // Ctrl/Cmd + wheel zooms; a plain wheel over a horizontal-only strip should
            // scroll it rather than do nothing, which is what a vertical wheel would.
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault()
              zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX)
            } else if (e.deltaX === 0 && e.deltaY !== 0 && laneRef.current) {
              e.preventDefault()
              laneRef.current.scrollLeft += e.deltaY
            }
          }}
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden relative"
        >
          {/* min-w-full so short projects still fill the track area. Without it the lanes
              ended mid-panel at whatever the content measured, which read as a rendering
              fault rather than as the end of the song. */}
          <div style={{ width }} className="relative min-w-full">
            <Ruler
              duration={duration}
              pxPerSecond={pxPerSecond}
              grid={grid}
              markers={project.markers}
              onSeekTo={seek}
            />

            {Array.from({ length: TIMELINE_LANES }, (_, lane) => (
              <div
                key={lane}
                className="relative border-b border-aura-line"
                style={{ height: LANE_HEIGHT }}
                onDoubleClick={(e) => {
                  if (!activeState) return
                  setSelectedStripId(
                    placeStrip(
                      activeState.id,
                      snapToGrid(timeFromClientX(e.clientX), grid, tolerance),
                      Math.max(2, duration / 8),
                      lane,
                    ),
                  )
                }}
              >
                {project.timelineStrips
                  .filter((strip) => strip.lane === lane)
                  .map((strip) => (
                    <StripView
                      key={strip.id}
                      strip={strip}
                      color={project.statesLibrary[strip.stateId]?.color ?? '#6366f1'}
                      name={project.statesLibrary[strip.stateId]?.name ?? 'Missing state'}
                      pxPerSecond={pxPerSecond}
                      selected={selectedStripId === strip.id}
                      onSelect={() => setSelectedStripId(strip.id)}
                      onDragStart={(kind, grabOffset) => {
                        drag.current =
                          kind === 'move'
                            ? { kind, stripId: strip.id, grabOffset }
                            : { kind, stripId: strip.id }
                      }}
                    />
                  ))}
              </div>
            ))}

            {/* Below the lanes: nothing is placeable here, and saying so is better than
                leaving an unexplained gap the same colour as a track. */}
            <div className="h-4" />

            <div
              ref={playheadRef}
              className="absolute top-0 bottom-0 left-0 w-px pointer-events-none z-10"
              style={{ backgroundColor: readToken('--color-aura-playhead', '#f1f5f9') }}
            />

            {/* Click the ruler or empty lane background to scrub. */}
            <div
              className="absolute top-0 left-0 right-0"
              style={{ height: RULER_HEIGHT }}
              onPointerDown={(e) => seek(timeFromClientX(e.clientX))}
            />
          </div>
        </div>
      </div>

      {project.timelineStrips.length === 0 && (
        <p className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-aura-line shrink-0">
          No strips — the whole song plays one continuous scene, which is a perfectly good
          video. Double-click a lane to place the selected state and start cutting.
        </p>
      )}
    </div>
  )
}

function Ruler({
  duration,
  pxPerSecond,
  grid,
  markers,
  onSeekTo,
}: {
  duration: number
  pxPerSecond: number
  grid: readonly number[]
  markers: readonly SectionMarker[]
  onSeekTo: (time: number) => void
}) {
  // Pick a label interval that keeps roughly 80px between ticks at any zoom, so the ruler
  // stays readable instead of collapsing into a solid bar.
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * pxPerSecond > 80) ?? 120
  const ticks = Math.ceil(duration / step) + 1

  return (
    <div
      className="relative border-b border-aura-line select-none"
      style={{ height: RULER_HEIGHT }}
    >
      {/* Beat grid behind the labels — faint, because it is reference not content. */}
      {pxPerSecond > 14 &&
        grid.map((beat, i) => (
          <span
            key={i}
            className="absolute top-0 bottom-0 w-px bg-aura-line"
            style={{ left: beat * pxPerSecond }}
          />
        ))}

      {Array.from({ length: ticks }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 text-[9px] font-mono tabular-nums text-slate-600 pl-1 border-l border-aura-line"
          style={{ left: i * step * pxPerSecond, height: RULER_HEIGHT }}
        >
          {formatTime(i * step)}
        </span>
      ))}

      {/* Markers sit above the scrub layer, so clicking a flag jumps to the marker rather
          than seeking to wherever the pointer happened to land. */}
      {markers.map((marker) => (
        <button
          key={marker.id}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSeekTo(marker.time)
          }}
          title={`${marker.label} at ${formatTime(marker.time)} — click to jump here`}
          className="absolute bottom-0 z-20 pl-0.5 border-l border-aura-state-solo text-aura-state-solo hover:text-slate-100 transition-colors"
          style={{ left: marker.time * pxPerSecond, height: RULER_HEIGHT }}
        >
          <span className="text-[9px] leading-none whitespace-nowrap">{marker.label}</span>
        </button>
      ))}
    </div>
  )
}

function StripView({
  strip,
  color,
  name,
  pxPerSecond,
  selected,
  onSelect,
  onDragStart,
}: {
  strip: Strip
  color: string
  name: string
  pxPerSecond: number
  selected: boolean
  onSelect: () => void
  onDragStart: (kind: Drag['kind'], grabOffset: number) => void
}) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
        const box = e.currentTarget.getBoundingClientRect()
        onDragStart('move', (e.clientX - box.left) / pxPerSecond)
      }}
      className="absolute top-0.5 bottom-0.5 rounded cursor-grab active:cursor-grabbing overflow-hidden"
      style={{
        left: strip.startTime * pxPerSecond,
        width: Math.max(6, strip.duration * pxPerSecond),
        backgroundColor: `${color}33`,
        border: `1px solid ${selected ? readToken('--color-aura-accent', '#6366f1') : color}`,
      }}
      title={`${name} · ${formatTime(strip.startTime)} for ${strip.duration.toFixed(2)}s`}
    >
      <span className="absolute inset-x-1.5 top-0.5 truncate text-[10px] text-slate-100 pointer-events-none">
        {name}
      </span>

      {/* Edge handles. Wide enough to hit without being wide enough to swallow a short
          strip's body. */}
      <span
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect()
          onDragStart('resize-start', 0)
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20"
      />
      <span
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect()
          onDragStart('resize-end', 0)
        }}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20"
      />
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function IconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-100 hover:bg-aura-surface transition-colors"
    >
      {children}
    </button>
  )
}
