import type { CompositionBridge } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import type { PipeStep } from '@symphonyscript/composer'
import { TransformEffect } from './TransformEffect'

/**
 * Parameters for constructing a {@link StretchBuilder}.
 *
 * Used internally; prefer the {@link stretch} notation entry-point.
 */
export interface StretchParams {
  /** Scaling factor for tick offsets and durations. 1 = no change, 2 = double. Defaults to 1. */
  factor: number
  /** Pipe-step groups to capture and stretch. Defaults to `[]`. */
  entries: PipeStep[][]
}

/**
 * Time-stretches captured notes by a factor.
 *
 * Extends {@link TransformEffect}: runs its scope on a recording bridge, collects emitted notes,
 * multiplies each note's tick and duration by `factor`, then replays to the target bridge. Notes
 * are re-emitted in tick order to preserve ordering. Uses clone-on-set immutability.
 *
 * Create via {@link stretch} — e.g. `stretch(2)` or `stretch(2, note('C4'), chord('Cmaj7'))`.
 * Supports `.steps()` to append pipe steps and `.default()` for an empty pass-through scope.
 *
 * @example
 * ```ts
 * stretch(2, note('C4'), note('E4'))      // Doubles tick and duration of both notes
 * stretch(0.5).steps(chord('Cmaj7'))      // Half the chord length
 * stretch(2).default()                    // No scoped steps (pass-through)
 * stretch()                               // factor=1, empty scope
 * stretch(2).factor(3)                    // Chain to change factor
 * ```
 */
export class StretchBuilder extends TransformEffect<StretchBuilder> {
  private readonly _factor: number

  constructor(params: Partial<StretchParams> = {}) {
    super(params.entries ?? [])
    this._factor = params.factor ?? 1
  }

  /**
   * Set the stretch factor. Note ticks and durations are multiplied by this value.
   *
   * @param factor - Multiplier (e.g. 2 = double length, 0.5 = half)

   * @returns New StretchBuilder with the updated factor
   */
  factor(factor: number): StretchBuilder {
    return new StretchBuilder({ factor, entries: this.entries })
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): StretchBuilder {
    return new StretchBuilder({ factor: this._factor, entries })
  }

  /**
   * Multiply each captured note's tick and duration by the stretch factor, sort by tick,
   * then replay onto the bridge. Advances bridge tick by `totalDuration * factor`.
   *
   * @internal
   */
  protected replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge {
    const sorted: CapturedNote[] = []

    for (let i = 0; i < notes.length; ++i) {
      sorted.push(notes[i])
    }

    sorted.sort((a, b) => a.tick - b.tick)

    let target = bridge

    for (let i = 0; i < sorted.length; ++i) {
      const note = sorted[i]
      target = target
        .withTick(bridge.tick + Math.round(note.tick * this._factor))
        .withNote(
          note.pitch,
          Math.round(note.duration * this._factor),
          note.velocity,
        )
    }

    return target.withTick(bridge.tick + Math.round(totalDuration * this._factor))
  }
}
