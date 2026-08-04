import type { PickedAudio, PickedFile, PlatformAdapter } from './PlatformAdapter'
import {
  canRememberHandles,
  forgetHandle,
  rememberHandle,
  reopenHandle,
  type StoredFileHandle,
} from './fileHandles'

/** Browser implementation.
 *
 *  Uses the File System Access API where it exists and falls back to an `<input>` plus a
 *  download anchor where it does not. The fallback is not a lesser code path to be
 *  ashamed of — Safari and Firefox are still on it, and "Save" meaning "download a copy"
 *  is a behaviour users already understand from every other web app. */

interface FileSystemHandleLike {
  name: string
  createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>
  getFile(): Promise<File>
}

interface PickerWindow {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemHandleLike[]>
  showSaveFilePicker?(options?: unknown): Promise<FileSystemHandleLike>
}

const picker = window as unknown as PickerWindow
const hasNativePicker = typeof picker.showSaveFilePicker === 'function'

/** The user cancelling a picker throws `AbortError`. That is not a failure and must not
 *  reach a console as one. */
function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function pickWithInput(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'

    // `cancel` is not universally supported, so the element is also removed on change.
    // Leaking one input per cancelled dialog would accumulate silently.
    const finish = (files: File[]) => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => finish([]))

    document.body.append(input)
    input.click()
  })
}

function download(name: string, bytes: Uint8Array, mime: string): boolean {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // Revoking immediately can cancel the download in some browsers; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

async function writeThroughPicker(
  suggestedName: string,
  bytes: Uint8Array,
  description: string,
  extension: string,
  mime: string,
): Promise<boolean> {
  if (!hasNativePicker) return download(suggestedName, bytes, mime)

  try {
    const handle = await picker.showSaveFilePicker!({
      suggestedName,
      types: [{ description, accept: { [mime]: [extension] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(bytes as unknown as BufferSource)
    await writable.close()
    return true
  } catch (error) {
    if (isCancellation(error)) return false
    // A picker can also fail on permission or an unsupported directory. Falling back
    // beats losing the user's work to an error dialog.
    console.warn('[platform] Save picker failed, falling back to download', error)
    return download(suggestedName, bytes, mime)
  }
}

export const WebPlatform: PlatformAdapter = {
  id: 'web',

  // A path cannot be stored, but a FileSystemFileHandle can — it is
  // structured-cloneable, so IndexedDB keeps it across sessions and reopening needs only
  // a permission grant. Better than a path: it survives the file being renamed or moved.
  canRelinkByPath: canRememberHandles(),
  // A background tab is throttled to roughly one frame a second, so a long queue would
  // appear to hang rather than progress.
  supportsBatchQueue: false,

  async openProject(): Promise<PickedFile | null> {
    if (picker.showOpenFilePicker) {
      try {
        const [handle] = await picker.showOpenFilePicker({
          types: [{ description: 'AURA project', accept: { 'application/json': ['.aura.json'] } }],
          multiple: false,
        })
        const file = await handle.getFile()
        return { name: file.name, bytes: await file.arrayBuffer() }
      } catch (error) {
        if (isCancellation(error)) return null
        console.warn('[platform] Open picker failed, falling back to input', error)
      }
    }

    const [file] = await pickWithInput('.json,application/json', false)
    return file ? { name: file.name, bytes: await file.arrayBuffer() } : null
  },

  saveProject(suggestedName, bytes) {
    return writeThroughPicker(
      suggestedName,
      bytes,
      'AURA project',
      '.aura.json',
      'application/json',
    )
  },

  writeVideo(suggestedName, bytes) {
    return writeThroughPicker(suggestedName, bytes, 'MP4 video', '.mp4', 'video/mp4')
  },

  async pickAudioFiles(): Promise<PickedAudio[]> {
    // The picker is preferred over an <input> for one reason: it returns handles, and a
    // handle is what lets a reopened project find its own audio again.
    if (picker.showOpenFilePicker) {
      try {
        const handles = await picker.showOpenFilePicker({
          types: [
            {
              description: 'Audio',
              accept: {
                'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
              },
            },
          ],
          multiple: true,
        })

        const picked: PickedAudio[] = []
        for (const handle of handles) {
          const file = await handle.getFile()
          const handleKey = `stem:${crypto.randomUUID()}`
          await rememberHandle(handleKey, handle as unknown as StoredFileHandle)
          picked.push({ file, handleKey })
        }
        return picked
      } catch (error) {
        if (isCancellation(error)) return []
        console.warn('[platform] Audio picker failed, falling back to input', error)
      }
    }

    // No handles on this path, so a reopened project will need a manual relink.
    const files = await pickWithInput('audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a', true)
    return files.map((file) => ({ file }))
  },

  reopenAudioFile(handleKey, interactive) {
    return reopenHandle(handleKey, interactive)
  },

  forgetAudioFile(handleKey) {
    return forgetHandle(handleKey)
  },
}
