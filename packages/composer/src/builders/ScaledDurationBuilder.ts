import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Parameters for {@link ScaledDurationBuilder}.
 */
export interface ScaledDurationParams {
  /** Number of notes to fit within the scaled span. */
  noteCount: number
  /** Beats (units of bridge defaultDuration) the span occupies. */
  overBeats: number
  /** Pipe steps to run with the scaled duration applied. */
  pipeSteps: PipeStep[]
}

/**
 * Base for duration-scaled builders such as tuplets and polyrhythms.
 *
 * Computes a scaled duration so that `noteCount` notes fit into `overBeats` beats:
 * `scaledDuration = round((overBeats * defaultDuration) / noteCount)`.
 * Each contained step runs with this as its `defaultDuration`.
 *
 * {@link TupletBuilder} extends this for tuplet notation (e.g. triplets).
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * tuplet(3, 2).steps(note('C4'), note('E4'), note('G4'))  // 3 notes in 2 beats
 * tuplet(5, 4).steps(note('A4'), note('B4'), ...)       // Quintuplet in 4 beats
 * ```
 */
export class ScaledDurationBuilder implements PipeStep {
  protected readonly params: ScaledDurationParams

  constructor(params: Partial<ScaledDurationParams>) {
    this.params = {
      noteCount: params.noteCount ?? 3,
      overBeats: params.overBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  /**
   * Set the number of beats the scaled span occupies.
   *
   * @param overBeats - Beats (units of bridge defaultDuration)
   * @returns New builder with the updated overBeats
   */
  overBeats(overBeats: number): ScaledDurationBuilder {
    return this.clone({ overBeats })
  }

  /**
   * Set the number of notes to fit within the scaled span.
   *
   * @param noteCount - Note count (e.g. 3 for triplet)
   * @returns New builder with the updated noteCount
   */
  noteCount(noteCount: number): ScaledDurationBuilder {
    return this.clone({ noteCount })
  }

  /**
   * Set the pipe steps to run with scaled duration applied.
   *
   * Each step receives `scaledDuration = round((overBeats * defaultDuration) / noteCount)` as its default duration.
   *
   * @param pipeSteps - One or more {@link PipeStep}s
   * @returns New builder with the updated steps
   */
  steps(...pipeSteps: PipeStep[]): ScaledDurationBuilder {
    return this.clone({ pipeSteps })
  }

  /**
   * Apply the scaled duration and run contained steps.
   *
   * Sets `defaultDuration` to the scaled value, runs each step sequentially, then restores the bridge.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge after all steps applied
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) {
      return bridge
    }

    const totalDuration = this.params.overBeats * bridge.defaultDuration
    const scaledDuration = Math.round(totalDuration / this.params.noteCount)
    let target = bridge.withDefaultDuration(scaledDuration)

    for (let i = 0; i < this.params.pipeSteps.length; ++i) {
      target = this.params.pipeSteps[i].apply(target)
    }

    return target
  }

  /** @internal */
  protected clone(overrides: Partial<ScaledDurationParams>): ScaledDurationBuilder {
    return new ScaledDurationBuilder({ ...this.params, ...overrides })
  }
}
