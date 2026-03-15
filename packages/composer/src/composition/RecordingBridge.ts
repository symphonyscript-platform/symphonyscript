import { ExecutionContext } from '@symphonyscript/core'
import type { CapturedNote } from '../interfaces/captured-note'
import { FrozenClip } from '../interfaces/frozen-clip'

interface RecordedNote extends CapturedNote {
  readonly sourceId: number
}

/**
 * An ExecutionContext that captures events into arrays
 * instead of writing to SAB. Used by freeze() and transforms.
 */
export class RecordingBridge implements ExecutionContext {
  private readonly notes: RecordedNote[] = []

  insertNote(
    pitch: number,
    velocity: number,
    duration: number,
    tick: number,
    muted: boolean,
    sourceId: number,
  ): number {
    this.notes.push({ pitch, velocity, duration, tick, muted, sourceId })
    return this.notes.length - 1
  }

  insertCC(_controller: number, _value: number, _tick: number, _sourceId: number): number {
    return 0
  }

  insertBend(_value: number, _tick: number, _sourceId: number): number {
    return 0
  }

  connect(_srcId: number, _tgtId: number, _weight?: number): void {}

  disconnect(_srcId: number, _tgtId: number): void {}

  reclaim(_nodePtr: number): void {}

  getPpq(): number {
    return 480
  }

  toFrozenClip(): FrozenClip {
    const captured: RecordedNote[] = []

    for (let i = 0; i < this.notes.length; ++i) {
      captured.push(this.notes[i])
    }

    let maxTick = 0

    for (let i = 0; i < captured.length; ++i) {
      const end = captured[i].tick + captured[i].duration
      if (end > maxTick) maxTick = end
    }

    return {
      noteCount: captured.length,
      duration: maxTick,
      visitNotes(callback) {
        for (let i = 0; i < captured.length; ++i) {
          const note = captured[i]
          callback(note.sourceId, note.pitch, note.velocity, note.duration, note.tick, note.muted)
        }
      },
    }
  }
}
