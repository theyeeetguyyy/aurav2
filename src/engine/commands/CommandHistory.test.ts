import { beforeEach, describe, expect, it } from 'vitest'
import { CommandHistory } from './CommandHistory'

/** The two properties that make undo usable rather than merely present: a drag is ONE
 *  step, and applying an undo does not record itself as a new command. Everything else
 *  here guards the stack bookkeeping around them. */

function step(label: string, log: string[], coalesceKey?: string) {
  return {
    label,
    coalesceKey,
    undo: () => log.push(`undo:${label}`),
    redo: () => log.push(`redo:${label}`),
  }
}

describe('CommandHistory', () => {
  beforeEach(() => CommandHistory.clear())

  it('starts empty', () => {
    expect(CommandHistory.canUndo).toBe(false)
    expect(CommandHistory.canRedo).toBe(false)
    expect(CommandHistory.undo()).toBe(false)
    expect(CommandHistory.redo()).toBe(false)
  })

  it('undoes and redoes in order', () => {
    const log: string[] = []
    CommandHistory.push(step('A', log))
    CommandHistory.push(step('B', log))

    CommandHistory.undo()
    CommandHistory.undo()
    expect(log).toEqual(['undo:B', 'undo:A'])

    CommandHistory.redo()
    CommandHistory.redo()
    expect(log).toEqual(['undo:B', 'undo:A', 'redo:A', 'redo:B'])
  })

  it('reports the pending labels', () => {
    const log: string[] = []
    CommandHistory.push(step('Add object', log))
    expect(CommandHistory.undoLabel).toBe('Add object')
    expect(CommandHistory.redoLabel).toBeNull()

    CommandHistory.undo()
    expect(CommandHistory.undoLabel).toBeNull()
    expect(CommandHistory.redoLabel).toBe('Add object')
  })

  it('collapses a drag into one step', () => {
    // The whole point: a scrub emits a change per pixel. Without coalescing, one drag
    // would cost two hundred presses of Ctrl+Z.
    const log: string[] = []
    for (let i = 0; i < 50; i++) CommandHistory.push(step(`edit${i}`, log, 'scene:radius'))

    expect(CommandHistory.undo()).toBe(true)
    expect(CommandHistory.canUndo).toBe(false)
    // The OLDEST undo survives — the state before the drag began.
    expect(log).toEqual(['undo:edit0'])
  })

  it('keeps the newest redo when coalescing', () => {
    const log: string[] = []
    CommandHistory.push(step('first', log, 'k'))
    CommandHistory.push(step('last', log, 'k'))

    CommandHistory.undo()
    CommandHistory.redo()
    // Undo goes to before the drag; redo goes to where it ended.
    expect(log).toEqual(['undo:first', 'redo:last'])
  })

  it('does not merge entries with different keys', () => {
    const log: string[] = []
    CommandHistory.push(step('a', log, 'scene:x'))
    CommandHistory.push(step('b', log, 'scene:y'))
    CommandHistory.undo()
    CommandHistory.undo()
    expect(log).toEqual(['undo:b', 'undo:a'])
  })

  it('never merges entries with no key', () => {
    const log: string[] = []
    CommandHistory.push(step('a', log))
    CommandHistory.push(step('b', log))
    expect(CommandHistory.undo()).toBe(true)
    expect(CommandHistory.canUndo).toBe(true)
  })

  it('drops the redo branch when a new action arrives', () => {
    const log: string[] = []
    CommandHistory.push(step('A', log))
    CommandHistory.undo()
    expect(CommandHistory.canRedo).toBe(true)

    CommandHistory.push(step('B', log))
    expect(CommandHistory.canRedo).toBe(false)
  })

  it('ignores pushes made while applying', () => {
    // Restoring a snapshot writes to stores, and those writes record changes. Without
    // this guard an undo would push its own inverse and the stack would never drain.
    const log: string[] = []
    CommandHistory.push({
      label: 'reentrant',
      undo: () => {
        log.push('undo')
        CommandHistory.push(step('should be ignored', log))
      },
      redo: () => log.push('redo'),
    })

    CommandHistory.undo()
    expect(log).toEqual(['undo'])
    expect(CommandHistory.canUndo).toBe(false)
  })

  it('bounds the stack', () => {
    const log: string[] = []
    for (let i = 0; i < 200; i++) CommandHistory.push(step(`s${i}`, log))

    let depth = 0
    while (CommandHistory.undo()) depth++
    expect(depth).toBeLessThanOrEqual(50)
    // The oldest entries are the ones dropped, so the most recent work stays undoable.
    expect(log[0]).toBe('undo:s199')
  })

  it('clears both stacks', () => {
    const log: string[] = []
    CommandHistory.push(step('A', log))
    CommandHistory.undo()
    CommandHistory.clear()
    expect(CommandHistory.canUndo).toBe(false)
    expect(CommandHistory.canRedo).toBe(false)
  })

  it('notifies subscribers', () => {
    let calls = 0
    const stop = CommandHistory.subscribe(() => calls++)
    CommandHistory.push(step('A', []))
    CommandHistory.undo()
    stop()
    CommandHistory.push(step('B', []))
    expect(calls).toBe(2)
  })
})
