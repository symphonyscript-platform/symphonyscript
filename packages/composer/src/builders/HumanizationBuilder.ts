import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { HumanizationBridge, HumanizationBridgeParams } from '../composition/HumanizationBridge'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { KNUTH_MULTIPLIER } from '../constants'

/**
 * Parameters for {@link HumanizationBuilder}.
 */
export interface HumanizationParams {
  /** Velocity jitter range. Each note gets ±jitter added to velocity. Units: raw velocity delta. Default 0. */
  velocityJitter: number
  /** Timing jitter range in ticks. Each note gets ±amount added to tick. Default 0. */
  timingAmount: number
  /** Seeded RNG for jitter. `null` uses tick-derived seed. */
  rng: SeededRandom | null
  /** Pipe-step groups to apply within the humanization scope. */
  entries: PipeStep[][]
}

/**
 * Humanization (timing and velocity variation). Wraps inner steps in a
 * {@link HumanizationBridge} that adds random jitter to each note's velocity
 * and tick. Jitter is symmetric: (rng.next() * 2 - 1) * amount.
 *
 * Extends {@link ScopedStepBuilder}. In scoped mode, applies only to steps
 * passed to `steps()`. In default mode (no steps or after `default()`), the
 * humanization cascades downstream. All builder methods return new instances
 * (clone-on-set immutability).
 *
 * @example
 * ```ts
 * humanize(50, 0).steps(note('C4'), note('D4'))     // Velocity jitter ±50
 * humanize(0, 20).steps(note('E4'))                // Timing jitter ±20 ticks
 * humanize(100, 20).seed(42).steps(note('C4'))
 * humanize(50, 10).default()                       // Cascade downstream
 * ```
 */
export class HumanizationBuilder extends ScopedStepBuilder<HumanizationBuilder> {
  private readonly params: Omit<HumanizationParams, 'entries' | 'seed'>

  constructor(params: Partial<HumanizationParams>) {
    super(params.entries ?? [])
    this.params = {
      velocityJitter: params.velocityJitter ?? 0,
      timingAmount: params.timingAmount ?? 0,
      rng: params.rng ?? null,
    }
  }

  /**
   * Set velocity jitter. Each note's velocity gets ±jitter added (symmetric range).
   *
   * @param jitter - Max velocity delta in millivels (e.g. ±50 for 0–1270 range)
   * @returns New builder with the updated velocity jitter
   */
  velocity(jitter: number): HumanizationBuilder {
    return this.clone({ velocityJitter: jitter })
  }

  /**
   * Set timing jitter. Each note's tick gets ±amount added in ticks.
   *
   * @param amount - Max timing offset in ticks
   * @returns New builder with the updated timing jitter
   */
  timing(amount: number): HumanizationBuilder {
    return this.clone({ timingAmount: amount })
  }

  /**
   * Set the RNG seed for reproducible jitter.
   *
   * @param seed - Integer seed for {@link SeededRandom}
   * @returns New builder with the given RNG seed
   */
  seed(seed: number): HumanizationBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    const rng = this.params.rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new HumanizationBridge(bridge, { ...this.params, rng })
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<HumanizationParams>): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
