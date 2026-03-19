import type { PipeStep } from '@symphonyscript/composer'
import { ScaledDurationBuilder, ScaledDurationParams } from './ScaledDurationBuilder'

/**
 * Polyrhythmic patterns. Evenly spaces `noteCount` notes over `overBeats` beats
 * by scaling the default duration: totalDuration = overBeats × defaultDuration,
 * then scaledDuration = totalDuration / noteCount for each inner step.
 *
 * Extends {@link ScaledDurationBuilder}. Each inner step receives the scaled
 * duration; notes are placed sequentially, advancing the tick. All builder
 * methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * polyrhythm(3, 2).steps(note('C4'), note('D4'), note('E4'))  // 3 notes over 2 beats
 * polyrhythm(5, 4).steps(note('C4'), note('E4'), note('G4'), note('B4'), note('C5'))
 * polyrhythm().noteCount(4).overBeats(3).steps(note('A4'), note('B4'), note('C5'), note('D5'))
 * ```
 */
export class PolyrhythmBuilder extends ScaledDurationBuilder {
  constructor(params: Partial<ScaledDurationParams>) {
    super(params)
  }

  /**
   * Set the number of beats over which notes are spread.
   *
   * @param overBeats - Beat count (e.g. 2 = half-note span)

   * @returns New PolyrhythmBuilder with updated overBeats
   */
  override overBeats(overBeats: number): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, overBeats })
  }

  /**
   * Set the number of notes to spread evenly over the beats.
   *
   * @param noteCount - Note count (e.g. 3 for triplet feel)

   * @returns New PolyrhythmBuilder with updated noteCount
   */
  override noteCount(noteCount: number): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, noteCount })
  }

  /**
   * Set the pipe steps to apply with scaled duration. Each step receives
   * scaledDuration = (overBeats × defaultDuration) / noteCount.
   *
   * @param pipeSteps - One or more {@link PipeStep}s to run with polyrhythmic timing

   * @returns New PolyrhythmBuilder with the given steps
   */
  override steps(...pipeSteps: PipeStep[]): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, pipeSteps })
  }

  /** @internal */
  protected override clone(overrides: Partial<ScaledDurationParams>): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, ...overrides })
  }
}
