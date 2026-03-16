import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Bridge decorator that probabilistically emits or skips notes.
 *
 * Each {@link withNote} call independently rolls against the configured probability
 * via {@link SeededRandom.bool}. When the roll fails, the note is suppressed and
 * tick advances by the note duration (treated as a rest). Uses {@link SeededRandom}
 * for deterministic, reproducible behaviour.
 *
 * Extends {@link CompositionBridgeDecorator}. Immutable — state changes produce
 * new bridge instances.
 *
 * @example
 * ```ts
 * // chance(0.7).steps(note('C4'), note('E4'), note('G4'))
 * // → roughly 70% of notes emit; skipped notes advance tick
 * ```
 *
 * @example
 * ```ts
 * chance(0.5, seed(42)).steps(note('C4'))
 * // Same seed yields same skip/emit sequence across runs
 * ```
 */
export class ChanceBridge extends CompositionBridgeDecorator {
  /**
   * @param bridge - Inner bridge to delegate to
   * @param probability - Probability of emitting (0–1). `rng.bool(probability)` true → emit
   * @param rng - Seeded RNG for deterministic rolls
   */
  constructor(
    bridge: CompositionBridge,
    private readonly probability: number,
    private readonly rng: SeededRandom,
  ) {
    super(bridge)
  }

  /**
   * Roll probability. On success, forward note to inner bridge; on failure, advance
   * tick by duration and skip emission.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in ticks; defaults to `defaultDuration`
   * @param velocity - Optional velocity override
   * @returns New bridge state wrapping the updated inner bridge
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (!this.rng.bool(this.probability)) {
      // Skip note — advance tick by duration as if it were a rest
      const actualDuration = duration ?? this.bridge.defaultDuration
      return this.rewrap(this.bridge.withTick(this.bridge.tick + actualDuration))
    }

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  /** @internal Preserves probability and RNG when re-wrapping. */
  protected rewrap(bridge: CompositionBridge): ChanceBridge {
    return new ChanceBridge(bridge, this.probability, this.rng)
  }
}
