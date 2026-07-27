import { create } from 'zustand'
import type { Track, ID, TrimBounds } from '@/types/audio'

/** Audio track state.
 *
 *  NOTE: the playhead deliberately does NOT live here. It is a per-frame value and
 *  belongs to TransportClock (docs/03-ARCHITECTURE.md HC-1) — writing it to Zustand
 *  at 60 Hz re-renders every subscriber every frame. React components that display
 *  the time use the useTransportTime() hook. */
interface AudioState {
  tracks: Track[]
  /** Coarse transport state. Changes at human rate, so React state is correct here. */
  isPlaying: boolean
  loopEnabled: boolean
  loopStart: number
  loopEnd: number

  addTrack: (track: Track) => void
  removeTrack: (id: ID) => void
  toggleSolo: (id: ID) => void
  toggleMute: (id: ID) => void
  setVolume: (id: ID, volume: number) => void
  setPlaying: (playing: boolean) => void
  setTrimBounds: (id: ID, bounds: TrimBounds) => void
  toggleLoop: () => void
  setLoopRegion: (start: number, end: number) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  tracks: [],
  isPlaying: false,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 0,

  addTrack: (track) => set((s) => ({ tracks: [...s.tracks, track] })),
  removeTrack: (id) => set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) })),
  toggleSolo: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)),
    })),
  toggleMute: (id) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, mute: !t.mute } : t)),
    })),
  setVolume: (id, volume) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, volume } : t)),
    })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setTrimBounds: (id, bounds) =>
    set((s) => ({
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, trimBounds: bounds } : t)),
    })),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),
  setLoopRegion: (start, end) => set({ loopStart: start, loopEnd: end }),
}))

/** Whether a track's signal should drive visual modulation.
 *
 *  Solo isolates BOTH audio and visuals — an explicit product requirement. This is
 *  the mechanism for the visual half, consumed by the modulation matrix.
 *
 *  Volume is deliberately NOT considered (docs/03-ARCHITECTURE.md HC-11): the fader
 *  is a mix control, not a visual control. Only solo and mute gate visuals. */
export function isTrackVisuallyActive(trackId: ID): boolean {
  const { tracks } = useAudioStore.getState()
  const track = tracks.find((t) => t.id === trackId)
  if (!track || track.mute) return false

  const anySoloed = tracks.some((t) => t.solo)
  return anySoloed ? track.solo : true
}
