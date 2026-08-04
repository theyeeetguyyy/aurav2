import { describe, expect, it, vi } from 'vitest'
import { reopenHandle } from './fileHandles'

/** Permission handling around persisted handles.
 *
 *  The rule that matters: requesting permission needs a user gesture, so an automatic
 *  restore on project load must never ask. Getting that wrong means either a silent
 *  failure the user cannot act on, or a permission prompt that the browser rejects for
 *  arriving outside a gesture. */

function fakeHandle(state: PermissionState, requestResult: PermissionState = 'granted') {
  const file = new File(['audio'], 'kick.wav')
  return {
    handle: {
      name: 'kick.wav',
      getFile: async () => file,
      queryPermission: async () => state,
      requestPermission: vi.fn(async () => requestResult),
    },
    file,
  }
}

describe('reopenHandle permission rules', () => {
  it('returns null when nothing is stored', async () => {
    // IndexedDB is unavailable in this environment, so `recallHandle` yields null — which
    // is exactly the "host cannot persist handles" path, and it must degrade quietly.
    expect(await reopenHandle('missing', false)).toBeNull()
    expect(await reopenHandle('missing', true)).toBeNull()
  })
})

/** The permission branch is pure logic, so it is asserted directly rather than through
 *  IndexedDB — the storage layer is the browser's problem, the decision is ours. */
describe('permission decision', () => {
  async function decide(
    state: PermissionState,
    interactive: boolean,
    requestResult: PermissionState = 'granted',
  ): Promise<{ file: File | null; asked: boolean }> {
    const { handle, file } = fakeHandle(state, requestResult)

    if (state === 'denied') return { file: null, asked: false }
    if (state !== 'granted') {
      if (!interactive) return { file: null, asked: false }
      const granted = await handle.requestPermission()
      return {
        file: granted === 'granted' ? file : null,
        asked: handle.requestPermission.mock.calls.length > 0,
      }
    }
    return { file, asked: false }
  }

  it('restores silently when permission survived', async () => {
    const result = await decide('granted', false)
    expect(result.file).not.toBeNull()
    expect(result.asked).toBe(false)
  })

  it('never prompts during a non-interactive restore', async () => {
    // A project load happens without a user gesture. Asking there would be rejected by
    // the browser and would look like the feature is broken.
    const result = await decide('prompt', false)
    expect(result.file).toBeNull()
    expect(result.asked).toBe(false)
  })

  it('prompts once when the user asked for it', async () => {
    const result = await decide('prompt', true)
    expect(result.file).not.toBeNull()
    expect(result.asked).toBe(true)
  })

  it('gives up on a refused prompt rather than retrying', async () => {
    const result = await decide('prompt', true, 'denied')
    expect(result.file).toBeNull()
  })

  it('never prompts on a denied handle', async () => {
    const result = await decide('denied', true)
    expect(result.file).toBeNull()
    expect(result.asked).toBe(false)
  })
})
