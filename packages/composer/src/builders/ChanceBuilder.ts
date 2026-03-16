import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { ChanceBridge } from '../composition/ChanceBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import type { PipeStep } from '@symphonyscript/composer'
import { KNUTH_MULTIPLIER } from '../constants'

/**
 * Parameters for {@link ChanceBuilder}.
 */
export interface ChanceParams {
  /** Probability of emitting each note (0–1). Defaults to 1 (always). */
  probability: number
  /** Seeded RNG for reproducible rolls. `null` uses tick-derived seed. */
  rng: SeededRandom | null
  /** Pipe-step groups to apply within the chance scope. */
  entries: PipeStep[][]
}

/**
 * Probabilistic note emission. Wraps inner steps in a {@link ChanceBridge} so that
 * each note independently rolls against the configured probability; failed rolls
 * emit a rest (advance tick) instead.
 *
 * Extends {@link ScopedStepBuilder}. In scoped mode, applies only to steps passed
 * to `steps()`. In default mode (no steps or after `default()`), the chance
 * modifier cascades downstream. All builder methods return new instances
 * (clone-on-set immutability).
 *
 * @example
 * ```ts
 * chance(1).steps(note('C4'))              // Always emits (probability 1)
 * chance(0.5).steps(note('C4'), note('D4'))// Each note has 50% chance
 * chance(0.5, 42).seed(999)               // Override seed for reproducibility
 * chance().probability(0.3).steps(note('E4'))
 * chance(0.5).default()                    // Cascade downstream
 * ```
 */
export class ChanceBuilder extends ScopedStepBuilder<ChanceBuilder> {
  private readonly _probability: number
  private readonly _rng: SeededRandom | null

  constructor(params: Partial<ChanceParams>) {
    super(params.entries ?? [])
    this._probability = params.probability ?? 1
    this._rng = params.rng ?? null
  }

  /**
   * Set the RNG seed for reproducible probability rolls.
   *
   * @param seed - Integer seed for {@link SeededRandom}

   * @returns New builder with the given RNG seed
   */
  seed(seed: number): ChanceBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  /**
   * Set the probability that each note is emitted (vs. skipped as a rest).
   *
   * @param probability - Value in 0–1. 0 = never emit, 1 = always emit

   * @returns New builder with the updated probability
   */
  probability(probability: number): ChanceBuilder {
    return this.clone({ probability })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    const rng = this._rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new ChanceBridge(bridge, this._probability, rng)
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): ChanceBuilder {
    return new ChanceBuilder({ probability: this._probability, rng: this._rng, entries })
  }

  private clone(overrides: Partial<ChanceParams>): ChanceBuilder {
    return new ChanceBuilder({
      probability: this._probability,
      rng: this._rng,
      entries: this.entries,
      ...overrides,
    })
  }
}
