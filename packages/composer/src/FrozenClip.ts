import type { IFrozenClip } from './interfaces/frozen-clip'
import type { RecordedNote, RecordedCC, RecordedBend } from './interfaces/recorded-events'

/**
 * Concrete implementation of IFrozenClip.
 * Holds captured notes, CC events, and bend events as immutable snapshot.
 */
export class FrozenClip implements IFrozenClip {
  readonly noteCount: number
  readonly duration: number

  private readonly _notes: RecordedNote[]
  private readonly _ccEvents: RecordedCC[]
  private readonly _bendEvents: RecordedBend[]

  constructor(
    notes: RecordedNote[],
    ccEvents: RecordedCC[],
    bendEvents: RecordedBend[],
  ) {
    this._notes = notes
    this._ccEvents = ccEvents
    this._bendEvents = bendEvents
    this.noteCount = notes.length
    this.duration = this.computeMaxTick()
  }

  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void,
  ): void {
    for (let i = 0; i < this._notes.length; ++i) {
      const note = this._notes[i]
      cb(note.sourceId, note.pitch, note.velocity, note.duration, note.tick, note.muted)
    }
  }

  visitCC(
    cb: (sourceId: number, controller: number, value: number, tick: number) => void,
  ): void {
    for (let i = 0; i < this._ccEvents.length; ++i) {
      const cc = this._ccEvents[i]
      cb(cc.sourceId, cc.controller, cc.value, cc.tick)
    }
  }

  visitBends(
    cb: (sourceId: number, value: number, tick: number) => void,
  ): void {
    for (let i = 0; i < this._bendEvents.length; ++i) {
      const bend = this._bendEvents[i]
      cb(bend.sourceId, bend.value, bend.tick)
    }
  }

  private computeMaxTick() {
    const notes = this._notes
    const ccEvents = this._ccEvents
    const bendEvents = this._bendEvents
    let maxTick = 0

    for (let i = 0; i < notes.length; ++i) {
      const end = notes[i].tick + notes[i].duration

      if (end > maxTick) {
        maxTick = end
      }
    }

    for (let i = 0; i < ccEvents.length; ++i) {
      if (ccEvents[i].tick > maxTick) {
        maxTick = ccEvents[i].tick
      }
    }

    for (let i = 0; i < bendEvents.length; ++i) {
      if (bendEvents[i].tick > maxTick) {
        maxTick = bendEvents[i].tick
      }
    }

    return maxTick
  }
}
