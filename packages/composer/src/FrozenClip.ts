import type { IFrozenClip } from './interfaces/frozen-clip'
import type { RecordedNote, RecordedCC, RecordedBend } from './interfaces/recorded-events'

/**
 * Immutable snapshot of a committed composition. Holds captured notes, CC events,
 * and pitch bends produced by {@link freeze} or {@link RecordingBridge.toFrozenClip}.
 *
 * Implementations of {@link IFrozenClip}; use the visit methods to read data.
 *
 * @example
 * ```ts
 * const frozen = freeze(note('C4').pipe(glide(0.5)))
 * frozen.visitNotes((src, pitch, vel, dur, tick, muted) => { ... })
 * frozen.visitCC((src, ctrl, val, tick) => { ... })
 * frozen.visitBends((src, val, tick) => { ... })
 * ```
 *
 * @example
 * ```ts
 * const clip = new FrozenClip(notes, ccEvents, bendEvents)
 * console.log(clip.noteCount, clip.duration)
 * ```
 */
export class FrozenClip implements IFrozenClip {
  /** Number of notes in the snapshot. */
  readonly noteCount: number

  /** End of the clip in ticks (max of note end-tick, CC tick, and bend tick). */
  readonly duration: number

  private readonly _notes: RecordedNote[]
  private readonly _ccEvents: RecordedCC[]
  private readonly _bendEvents: RecordedBend[]

  /**
   * Create an immutable snapshot from recorded events.
   *
   * @param notes - Captured notes (from {@link RecordingBridge}).
   * @param ccEvents - Captured CC events.
   * @param bendEvents - Captured pitch bend events.
   */
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

  /**
   * Invoke callback for each note in the snapshot.
   *
   * @param cb - Callback invoked per note. Receives: sourceId (source slot id),
   *   pitch (absolute cents from C0), velocity (0–1000), duration (ticks), tick (ticks), muted.
   */
  visitNotes(
    cb: (sourceId: number, pitch: number, velocity: number,
         duration: number, tick: number, muted: boolean) => void,
  ): void {
    for (let i = 0; i < this._notes.length; ++i) {
      const note = this._notes[i]
      cb(note.sourceId, note.pitch, note.velocity, note.duration, note.tick, note.muted)
    }
  }

  /**
   * Invoke callback for each CC event in the snapshot.
   *
   * @param cb - Callback invoked per CC event. Receives: sourceId (source slot id),
   *   controller (MIDI CC 0–127), value (0–127), tick (ticks).
   */
  visitCC(
    cb: (sourceId: number, controller: number, value: number, tick: number) => void,
  ): void {
    for (let i = 0; i < this._ccEvents.length; ++i) {
      const cc = this._ccEvents[i]
      cb(cc.sourceId, cc.controller, cc.value, cc.tick)
    }
  }

  /**
   * Invoke callback for each pitch bend in the snapshot.
   *
   * @param cb - Callback invoked per bend event. Receives: sourceId (source slot id),
   *   value (normalized bend: 0 = full down, 0.5 = center, 1 = full up), tick (ticks).
   */
  visitBends(
    cb: (sourceId: number, value: number, tick: number) => void,
  ): void {
    for (let i = 0; i < this._bendEvents.length; ++i) {
      const bend = this._bendEvents[i]
      cb(bend.sourceId, bend.value, bend.tick)
    }
  }

  /**
   * Compute the clip duration as the maximum of: note end-tick (tick + duration),
   * CC tick, and bend tick across all events.
   *
   * @internal
   */
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
