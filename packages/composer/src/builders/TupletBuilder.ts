import type { PipeStep } from '@symphonyscript/composer'
import { ScaledDurationBuilder, ScaledDurationParams } from './ScaledDurationBuilder'

/**
 * Parameters for {@link TupletBuilder}.
 *
 * Extends {@link ScaledDurationParams}. `count` and `inBeats` alias
 * `noteCount` and `overBeats` for tuplet-style cue (e.g. "3 in 2").
 */
export interface TupletParams extends ScaledDurationParams {
  /** Number of notes in the tuplet. Maps to noteCount. Default 3. */
  count: number
  /** Beats the tuplet spans. Maps to overBeats. Default 2. */
  inBeats: number
}

/**
 * Immutable builder for tuplets (e.g. triplets: fit N notes into M beats).
 *
 * Applies a scaled duration so that `count` notes fit into `inBeats` beats.
 * Each contained step receives `(inBeats * defaultDuration) / count` ticks per note.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * tuplet(3, 2).steps(note('C4'), note('E4'), note('G4'))  // Triplet: 3 notes in 2 beats
 * tuplet(5, 4).steps(note('A4'), note('B4'), ...)       // Quintuplet in 4 beats
 * tuplet().count(3).inBeats(2).steps(note('C4'), ...)    // Chain overrides
 * tuplet(3, 2).steps(note('C4'), chord('Am')).apply(b)   // Mixed step types
 * ```
 */
export class TupletBuilder extends ScaledDurationBuilder {
  constructor(params: Partial<TupletParams>) {
    super({
      noteCount: params.noteCount ?? params.count ?? 3,
      overBeats: params.overBeats ?? params.inBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    })
  }

  /**
   * Set the number of beats the tuplet spans.
   *
   * @param inBeats - Beats (units of defaultDuration)

   * @returns New TupletBuilder with the updated inBeats
   */
  inBeats(inBeats: number): TupletBuilder {
    return new TupletBuilder({ ...this.params, overBeats: inBeats })
  }

  /**
   * Set the number of notes in the tuplet.
   *
   * @param count - Note count (e.g. 3 for triplet)

   * @returns New TupletBuilder with the updated count
   */
  count(count: number): TupletBuilder {
    return new TupletBuilder({ ...this.params, noteCount: count })
  }

  /**
   * Set the pipe steps to run inside the tuplet.
   *
   * Each step receives scaled duration = (inBeats * defaultDuration) / count.
   * Step count should match count for correct tuplet behavior.
   *
   * @param pipeSteps - One or more {@link PipeStep}s (e.g. note, chord)

   * @returns New TupletBuilder with the updated steps
   */
  override steps(...pipeSteps: PipeStep[]): TupletBuilder {
    return new TupletBuilder({ ...this.params, pipeSteps })
  }

  /** @internal */
  protected override clone(overrides: Partial<ScaledDurationParams>): TupletBuilder {
    return new TupletBuilder({ ...this.params, ...overrides })
  }
}
