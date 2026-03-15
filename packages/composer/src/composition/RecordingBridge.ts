import { ExecutionContext } from '@symphonyscript/core'
import type { IFrozenClip } from '../interfaces/frozen-clip'
import type { RecordedNote, RecordedCC, RecordedBend } from '../interfaces/recorded-events'
import { FrozenClip } from '../FrozenClip'

/**
 * An ExecutionContext that captures events into arrays
 * instead of writing to SAB. Used by freeze() and transforms.
 */
export class RecordingBridge implements ExecutionContext {
  private readonly notes: RecordedNote[] = []
  private readonly ccEvents: RecordedCC[] = []
  private readonly bendEvents: RecordedBend[] = []

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

  insertCC(controller: number, value: number, tick: number, sourceId: number): number {
    this.ccEvents.push({ controller, value, tick, sourceId })
    return this.ccEvents.length - 1
  }

  insertBend(value: number, tick: number, sourceId: number): number {
    this.bendEvents.push({ value, tick, sourceId })
    return this.bendEvents.length - 1
  }

  connect(_srcId: number, _tgtId: number, _weight?: number): void {}

  disconnect(_srcId: number, _tgtId: number): void {}

  reclaim(_nodePtr: number): void {}

  getPpq(): number {
    return 480
  }

  toFrozenClip(): IFrozenClip {
    const capturedNotes: RecordedNote[] = []

    for (let i = 0; i < this.notes.length; ++i) {
      capturedNotes.push(this.notes[i])
    }

    const capturedCC: RecordedCC[] = []

    for (let i = 0; i < this.ccEvents.length; ++i) {
      capturedCC.push(this.ccEvents[i])
    }

    const capturedBends: RecordedBend[] = []

    for (let i = 0; i < this.bendEvents.length; ++i) {
      capturedBends.push(this.bendEvents[i])
    }

    return new FrozenClip(capturedNotes, capturedCC, capturedBends)
  }
}
