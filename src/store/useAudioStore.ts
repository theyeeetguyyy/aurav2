import { create } from 'zustand'
import type { Track, ID } from '@/types/audio'

interface AudioState {
  tracks: Track[]
  /** Master playback state */
  isPlaying: boolean
  /** Current playhead position in seconds */
  currentTime: number
  /** Loop enabled */
  loopEnabled: boolean
  /** Loop region */
  loopStart: number
  loopEnd: number

  // Actions
  addTrack: (track: Track) => void
  removeTrack: (id: ID) => void
  toggleSolo: (id: ID) => void
  toggleMute: (id: ID) => void
  setVolume: (id: ID, volume: number) => void
  setPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  toggleLoop: () => void
  setLoopRegion: (start: number, end: number) => void
}

export const useAudioStore = create<AudioState>((set) => ({
  tracks: [],
  isPlaying: false,
  currentTime: 0,
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
  setCurrentTime: (time) => set({ currentTime: time }),
  toggleLoop: () => set((s) => ({ loopEnabled: !s.loopEnabled })),
  setLoopRegion: (start, end) => set({ loopStart: start, loopEnd: end }),
}))
