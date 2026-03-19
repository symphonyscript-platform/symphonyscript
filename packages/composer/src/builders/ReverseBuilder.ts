import type { CompositionBridge } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import type { PipeStep } from '@symphonyscript/composer'
import { TransformEffect } from './TransformEffect'

/**
 * Replays notes in reverse temporal order within the scope.
 *
 * Extends {@link TransformEffect} and uses the **capture-transform-replay** pattern:
 * captures notes from the composed scope, reverses their tick positions so the last
 * note becomes first (and vice versa), then emits them onto the bridge. Total
 * duration is preserved.
 *
 * Supports `steps()`, `default()`, and `apply()` inherited from {@link TransformEffect}.
 * `apply()` runs the capture-transform-replay pipeline; use the {@link reverse} cue.
 *
 * @example
 * ```ts
 * reverse()                                    // No steps (pass-through when applied)
 * reverse().steps(note('C4'), note('E4'))     // Emits E4 then C4
 * reverse().steps(chord('Cmaj7'))             // Chord reversed
 * reverse(note('C4'), note('D4'), note('E4')) // Same as .steps(...) via cue
 * reverse().default()                          // Explicit pass-through
 * ```
 */
export class ReverseBuilder extends TransformEffect<ReverseBuilder> {
  constructor(entries: PipeStep[][] = []) {
    super(entries)
  }

  /** @internal Clones with new entries to preserve type in method chains. */
  protected cloneWithEntries(entries: PipeStep[][]): ReverseBuilder {
    return new ReverseBuilder(entries)
  }

  /**
   * Reverse tick positions so notes replay last-to-first, then emit onto the bridge.
   *
   * For each note, new tick = totalDuration - originalTick - duration, placing it
   * at the mirror position in the clip. Reversed notes are sorted by tick and
   * emitted in order; the bridge tick is advanced to bridge.tick + totalDuration.
   *
   * @param notes - Notes captured from the scope composition pass
   * @param totalDuration - Total clip duration in beats
   * @param bridge - Target bridge at the insertion point

   * @returns Bridge with reversed notes emitted
   */
  protected replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge {
    // Reverse tick positions: new_tick = totalDuration - original_tick - duration
    const reversed: CapturedNote[] = []

    for (let i = 0; i < notes.length; ++i) {
      const note = notes[i]
      reversed.push({
        pitch: note.pitch,
        velocity: note.velocity,
        duration: note.duration,
        tick: totalDuration - note.tick - note.duration,
        muted: note.muted,
      })
    }

    reversed.sort((a, b) => a.tick - b.tick)

    let target = bridge

    for (let i = 0; i < reversed.length; ++i) {
      const note = reversed[i]
      target = target.withTick(bridge.tick + note.tick)
      target = target.withNote(note.pitch, note.duration, note.velocity)
    }

    return target.withTick(bridge.tick + totalDuration)
  }
}
