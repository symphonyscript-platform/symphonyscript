import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Parameters for {@link LoopBuilder}.
 *
 * Used internally when constructing and cloning loop instances.
 */
export interface LoopParams {
  /** Number of times to run the sequence. Default 1. */
  count: number
  /** {@link PipeStep}s to apply in order, once per loop iteration. */
  pipeSteps: PipeStep[]
}

/**
 * Immutable builder that loops a sequence of steps N times.
 *
 * Repeats the composed output of the given pipe steps sequentially. Each
 * iteration applies all steps in order to the current bridge state, so the
 * bridge advances naturally (tick, deferred events) across iterations.
 *
 * Entry points: {@link loop} for multi-step loops, {@link repeat} for a
 * single-step loop shorthand.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * loop(3, note('C4'))                           // C4 three times (same as repeat(3, note('C4')))
 * loop(2, note('C4'), note('E4'), note('G4'))   // C4, E4, G4, C4, E4, G4
 * loop().steps(note('C4')).count(4)              // C4 four times
 * repeat(3, chord('Am'))                         // Am chord three times
 * loop(1, note('C4'))                            // Single pass (count=1)
 * ```
 */
export class LoopBuilder implements PipeStep {
  private readonly params: LoopParams

  constructor(params: Partial<LoopParams>) {
    this.params = {
      count: params.count ?? 1,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  /**
   * Set the number of times to repeat the step sequence.
   *
   * @param count - Loop iterations (≥ 1)

   * @returns New LoopBuilder with the updated count
   */
  count(count: number): LoopBuilder {
    return this.clone({ count })
  }

  /**
   * Set the pipe steps to run each iteration. Replaces any previously configured steps.
   *
   * @param pipeSteps - One or more {@link PipeStep}s to apply in order per iteration

   * @returns New LoopBuilder with the specified steps
   */
  steps(...pipeSteps: PipeStep[]): LoopBuilder {
    return this.clone({ pipeSteps })
  }

  /**
   * Run the step sequence `count` times, updating the bridge after each iteration.
   *
   * Applies each pipe step in order for every iteration. The bridge state
   * (tick, notes, topology) accumulates across iterations, so repeated steps
   * advance the composition timeline naturally.
   *
   * Returns the bridge unchanged when `pipeSteps` is empty.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with all iterations applied
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) return bridge

    let target = bridge

    for (let i = 0; i < this.params.count; ++i) {
      for (let j = 0; j < this.params.pipeSteps.length; ++j) {
        target = this.params.pipeSteps[j].apply(target)
      }
    }

    return target
  }

  /** @internal Creates a new LoopBuilder with merged overrides. */
  private clone(overrides: Partial<LoopParams>): LoopBuilder {
    return new LoopBuilder({ ...this.params, ...overrides })
  }
}
