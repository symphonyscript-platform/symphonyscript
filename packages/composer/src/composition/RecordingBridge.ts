import { ExecutionContext } from '@symphonyscript/core'
import type { IFrozenClip } from '../interfaces/frozen-clip'
import type { RecordedNote, RecordedCC, RecordedBend } from '../interfaces/recorded-events'
import { FrozenClip } from '../FrozenClip'

/**
 * ExecutionContext implementation that captures notes, CC events, and pitch bends
 * into arrays instead of writing to a shared audio buffer (SAB). Used by
 * {@link freeze} and the capture phase of {@link TransformEffect}.
 *
 * Composed bridges call `commit(recorder)`; each thunk invokes insertNote,
 * insertCC, or insertBend on this bridge, appending to internal arrays.
 * Call {@link toFrozenClip} to obtain an immutable {@link IFrozenClip} snapshot.
 *
 * connect, disconnect, and reclaim are no-ops — topology is not captured.
 *
 * @example
 * ```ts
 * const bridge = new BaseCompositionBridge().withNote(60, 1).withCC(7, 80)
 * const recorder = new RecordingBridge()
 * bridge.commit(recorder)
 * const frozen = recorder.toFrozenClip()
 * frozen.visitNotes((src, pitch, vel, dur, tick, muted) => { ... })
 * ```
 *
 * @example
 * ```ts
 * // freeze() uses RecordingBridge internally
 * const frozen = freeze(note('C4').pipe(glide(0.5)))
 * ```
 */
export class RecordingBridge implements ExecutionContext {
  private readonly notes: RecordedNote[] = []
  private readonly ccEvents: RecordedCC[] = []
  private readonly bendEvents: RecordedBend[] = []

  /**
   * Append a note to the captured notes array.
   *
   * @param pitch - Pitch in absolute cents from C0
   * @param velocity - Note velocity (0–1000; same units as bridge)
   * @param duration - Note duration in ticks (converted at output boundary)
   * @param tick - Start tick (PPQ 480)
   * @param muted - Whether the note is muted
   * @param sourceId - Opaque id for correlation during visit callbacks

   * @returns Index of the inserted note (0-based)
   */
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

  /**
   * Append a CC event to the captured CC array.
   *
   * @param controller - MIDI controller number (0–127)
   * @param value - CC value (0–127)
   * @param tick - Event tick (PPQ 480)
   * @param sourceId - Opaque id for correlation during visit callbacks

   * @returns Index of the inserted event (0-based)
   */
  insertCC(controller: number, value: number, tick: number, sourceId: number): number {
    this.ccEvents.push({ controller, value, tick, sourceId })
    return this.ccEvents.length - 1
  }

  /**
   * Append a pitch bend event to the captured bend array.
   *
   * @param value - Pitch bend value (14-bit: 0 = full down, 8192 = center, 16383 = full up)
   * @param tick - Event tick (PPQ 480)
   * @param sourceId - Opaque id for correlation during visit callbacks

   * @returns Index of the inserted event (0-based)
   */
  insertBend(value: number, tick: number, sourceId: number): number {
    this.bendEvents.push({ value, tick, sourceId })
    return this.bendEvents.length - 1
  }

  /** No-op. Topology (synapse connections) is not captured. */
  connect(_srcId: number, _tgtId: number, _weight?: number): void {}

  /** No-op. Topology is not captured. */
  disconnect(_srcId: number, _tgtId: number): void {}

  /** No-op. Node reclamation is not captured. */
  reclaim(_nodePtr: number): void {}

  /**
   * Return pulses per quarter note. Fixed at 480.
   *
   * @returns 480
   */
  getPpq(): number {
    return 480
  }

  /**
   * Build an immutable snapshot of all captured notes, CC events, and bends.
   * Use the returned {@link IFrozenClip} to visit events via visitNotes,
   * visitCC, and visitBends.
   *
   * @returns Immutable {@link IFrozenClip} with copies of the captured arrays
   */
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
