import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Configuration for {@link HumanizationBridge}.
 */
export interface HumanizationBridgeParams {
  /** Max velocity deviation in either direction. Uniform in [-velocityJitter, +velocityJitter]. */
  velocityJitter: number
  /** Max timing offset in beats. Uniform in [-timingAmount, +timingAmount]. */
  timingAmount: number
  /** Seeded RNG for jitter values. Same seed yields same humanization per run. */
  rng: SeededRandom
}

/**
 * Bridge decorator that adds humanization (timing and velocity jitter) to notes.
 *
 * Each note gets a random velocity offset and tick offset drawn uniformly from
 * the configured ranges. When `precise` mode is active, humanization is bypassed
 * and notes pass through unmodified.
 *
 * Jitter formula: `(rng.next() * 2 - 1) * amount` → uniform in [-amount, +amount].
 *
 * Extends {@link CompositionBridgeDecorator}. Immutable.
 *
 * @example
 * ```ts
 * humanize({ velocityJitter: 10, timingAmount: 24, rng }).steps(note('C4'))
 * // Velocity ±10, tick ±24 ticks
 * ```
 */
export class HumanizationBridge extends CompositionBridgeDecorator {
  /**
   * @param bridge - Inner bridge to delegate to
   * @param params - Velocity jitter, timing amount, and RNG
   */
  constructor(
    bridge: CompositionBridge,
    private readonly params: HumanizationBridgeParams,
  ) {
    super(bridge)
  }

  /**
   * Add jitter to velocity and tick, then emit the note.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in beats; defaults to `defaultDuration`
   * @param velocity - Optional velocity override (jitter applied on top)

   * @returns New bridge state wrapping the updated inner bridge
   */
  override withNote(pitch: number, duration?: number, velocity?: number): HumanizationBridge {
    if (this.precise) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    const vel = (velocity ?? this.velocity) + this.jitter(this.params.velocityJitter)
    const tickOffset = this.jitter(this.params.timingAmount)

    return this.rewrap(
      this.bridge
        .withTick(this.tick + tickOffset)
        .withNote(pitch, duration, vel)
    )
  }

  /** @internal Preserves humanization params when re-wrapping. */
  protected rewrap(bridge: CompositionBridge): HumanizationBridge {
    return new HumanizationBridge(
      bridge,
      this.params,
    )
  }

  /**
   * Uniform jitter in [-amount, +amount] via rng.next() * 2 - 1.
   *
   * @param amount - Half-width of the range

   * @returns Value in [-amount, +amount]
   */
  private jitter(amount: number): number {
    return (this.params.rng.next() * 2 - 1) * amount
  }
}
