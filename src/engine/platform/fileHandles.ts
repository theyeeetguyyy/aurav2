/** Persisted file handles, so reopening a project can reopen its stems.
 *
 *  A browser cannot store a *path* — but it can store a `FileSystemFileHandle`, which is
 *  structured-cloneable and therefore survives in IndexedDB across sessions. On reopen the
 *  handle is still valid; only the permission needs re-granting, and one click covers
 *  every stem at once.
 *
 *  This is what `canRelinkByPath: false` was hedging about, and it was too pessimistic:
 *  you cannot relink by path, but you can relink by handle, which is better — it survives
 *  the file being renamed or moved.
 *
 *  Lives in `engine/platform/` because IndexedDB and the File System Access API are host
 *  capability, and nothing outside this folder may touch either (03-ARCHITECTURE §1). */

const DB_NAME = 'aura-file-handles'
const STORE = 'handles'
const DB_VERSION = 1

/** Minimal shape of what we store. Typed structurally so this file does not depend on
 *  lib.dom's evolving File System Access declarations. */
export interface StoredFileHandle {
  name: string
  getFile(): Promise<File>
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  // Private browsing and some enterprise policies disable IndexedDB entirely. Handle
  // persistence is an optimisation, so failing means "fall back to manual relink", never
  // "the app is broken".
  try {
    const db = await openDb()
    return await new Promise<T | null>((resolve) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function rememberHandle(key: string, handle: StoredFileHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, key) as IDBRequest<unknown>)
}

export async function recallHandle(key: string): Promise<StoredFileHandle | null> {
  return withStore<StoredFileHandle>('readonly', (store) => store.get(key))
}

export async function forgetHandle(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key) as IDBRequest<unknown>)
}

/** Read a remembered file back.
 *
 *  `interactive` decides whether permission may be *requested*. Requesting requires a user
 *  gesture, so an automatic restore on project load passes false — it silently recovers
 *  the stems whose permission is still granted — and the "Restore audio" button passes
 *  true to re-grant the rest in one click. */
export async function reopenHandle(key: string, interactive: boolean): Promise<File | null> {
  const handle = await recallHandle(key)
  if (!handle) return null

  try {
    const state = (await handle.queryPermission?.({ mode: 'read' })) ?? 'granted'
    if (state === 'denied') return null

    if (state !== 'granted') {
      if (!interactive) return null
      const granted = await handle.requestPermission?.({ mode: 'read' })
      if (granted !== 'granted') return null
    }

    return await handle.getFile()
  } catch {
    // The file was deleted, the drive is gone, or the handle expired. Manual relink
    // remains the fallback.
    return null
  }
}

export function canRememberHandles(): boolean {
  return typeof indexedDB !== 'undefined' && typeof window !== 'undefined' &&
    'showOpenFilePicker' in window
}
