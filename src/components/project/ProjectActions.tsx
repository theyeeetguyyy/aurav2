import { useCallback, useState } from 'react'
import { FolderOpen, Link2, Loader2, Save } from 'lucide-react'
import { MultiTrackRack } from '@/engine/audio/MultiTrackRack'
import { AudioFeatures } from '@/engine/audio/AudioFeatures'
import { RealtimeAnalyser } from '@/engine/audio/RealtimeAnalyser'
import { platform } from '@/engine/platform/PlatformAdapter'
import {
  openProjectFromDisk,
  relinkStems,
  restoreStemAudio,
  saveProjectToDisk,
} from '@/project/projectBridge'
import { useAudioStore } from '@/store/useAudioStore'
import { useProjectStore } from '@/store/useProjectStore'

/** Save, Open, and Restore.
 *
 *  Restore is the interesting one. Stems picked through the file dialog remember their own
 *  file (a `FileSystemFileHandle` in IndexedDB), so reopening a project brings the audio
 *  back — silently where the permission survived, and in one click where it did not.
 *  Dropped files carry no handle and still need re-picking, which the button falls through
 *  to. It only appears while stems are actually missing. */

/** Re-register the live tap, and re-analyse only if the cached timelines did not come
 *  back with the project — the cache is the whole reason reopening is instant. */
function attachAnalysis(id: string): void {
  RealtimeAnalyser.register(id)
  const track = useAudioStore.getState().tracks.find((t) => t.id === id)
  if (track?.buffer && !AudioFeatures.has(id)) void AudioFeatures.analyse(id, track.buffer)
}

export function ProjectActions() {
  const name = useProjectStore((s) => s.project.name)
  const tracks = useAudioStore((s) => s.tracks)
  const [busy, setBusy] = useState<'save' | 'open' | 'relink' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const missing = tracks.filter((t) => t.buffer === null)

  const notify = useCallback((text: string | null) => {
    setMessage(text)
    if (text) setTimeout(() => setMessage((current) => (current === text ? null : current)), 4000)
  }, [])

  const handleSave = async () => {
    setBusy('save')
    try {
      const saved = await saveProjectToDisk(name)
      notify(saved ? 'Project saved' : null)
    } catch (error) {
      console.error('[project] Save failed', error)
      notify('Save failed — see console')
    } finally {
      setBusy(null)
    }
  }

  const handleOpen = async () => {
    setBusy('open')
    try {
      const { ok, message: failure, restored = 0 } = await openProjectFromDisk()
      if (failure) {
        notify(failure)
      } else if (ok) {
        for (const track of useAudioStore.getState().tracks) {
          if (track.buffer) attachAnalysis(track.id)
        }
        const missing = useAudioStore.getState().tracks.filter((t) => !t.buffer).length
        notify(
          missing === 0
            ? `Project opened · ${restored} stem${restored === 1 ? '' : 's'} restored`
            : `Project opened — click Restore to bring back ${missing} stem${missing === 1 ? '' : 's'}`,
        )
      }
    } catch (error) {
      console.error('[project] Open failed', error)
      notify('Could not open that project — see console')
    } finally {
      setBusy(null)
    }
  }

  const handleRelink = async () => {
    setBusy('relink')
    try {
      // Try the remembered handles first — this is a user gesture, so permission can be
      // requested, and one click brings back every stem that was picked rather than
      // dropped. Only what is left needs the file dialog.
      const restored = await restoreStemAudio(true)
      for (const id of restored) attachAnalysis(id)

      if (useAudioStore.getState().tracks.every((t) => t.buffer)) {
        notify(`Restored ${restored.length} stem${restored.length === 1 ? '' : 's'}`)
        return
      }

      const picked = await platform().pickAudioFiles()
      const rack = MultiTrackRack.getInstance()

      const decoded: { file: File; buffer: AudioBuffer }[] = []
      for (const { file } of picked) {
        try {
          decoded.push({ file, buffer: await rack.decodeFile(file) })
        } catch (error) {
          console.error(`[project] Could not decode ${file.name}`, error)
        }
      }

      const matched = relinkStems(decoded)
      for (const id of matched) attachAnalysis(id)

      const total = restored.length + matched.length
      const unmatched = decoded.length - matched.length
      notify(
        total === 0
          ? 'No filenames matched this project’s stems'
          : `Restored ${total} stem${total === 1 ? '' : 's'}${
              unmatched > 0 ? ` · ${unmatched} did not match` : ''
            }`,
      )
    } catch (error) {
      console.error('[project] Relink failed', error)
      notify('Relink failed — see console')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {message && (
        <span className="text-[10px] text-slate-400 mr-1 truncate max-w-[240px]">{message}</span>
      )}

      {missing.length > 0 && (
        <Action
          label={`Restore ${missing.length}`}
          title={`${missing.length} stem${missing.length === 1 ? '' : 's'} have no audio. Stems picked through the file dialog remember their own file and come back in one click; dropped ones need re-picking. Analysis is cached either way.`}
          icon={busy === 'relink' ? Loader2 : Link2}
          spinning={busy === 'relink'}
          highlight
          onClick={handleRelink}
          disabled={busy !== null}
        />
      )}

      <Action
        label="Open"
        title="Open a .aura.json project"
        icon={busy === 'open' ? Loader2 : FolderOpen}
        spinning={busy === 'open'}
        onClick={handleOpen}
        disabled={busy !== null}
      />
      <Action
        label="Save"
        title="Save this project. Stems are referenced, not embedded; their analysis is cached."
        icon={busy === 'save' ? Loader2 : Save}
        spinning={busy === 'save'}
        onClick={handleSave}
        disabled={busy !== null}
      />
    </div>
  )
}

function Action({
  label,
  title,
  icon: Icon,
  onClick,
  disabled,
  spinning,
  highlight,
}: {
  label: string
  title: string
  icon: typeof Save
  onClick: () => void
  disabled?: boolean
  spinning?: boolean
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex items-center gap-1.5 h-6 px-2 rounded border text-[10px] font-medium transition-colors',
        highlight
          ? 'border-aura-accent text-aura-accent hover:bg-aura-surface'
          : 'border-aura-line text-slate-400 hover:text-slate-100 hover:bg-aura-surface',
        disabled ? 'opacity-50 cursor-default' : '',
      ].join(' ')}
    >
      <Icon className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}
