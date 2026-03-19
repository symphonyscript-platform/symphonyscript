import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Degree } from '@symphonyscript/core'
import { RomanBuilder } from './RomanBuilder'

/**
 * Parameters for {@link ProgressionBuilder}.
 *
 * A chord progression is a sequence of roman numerals, each resolved via {@link RomanBuilder}.
 */
export interface ProgressionParams {
  /** Ordered roman numerals (e.g. I–V–vi–IV). */
  numerals: Degree[]
  /** Per-chord duration in beats. `null` = use bridge default. */
  duration: number | null
  /** Velocity override for all chords. `null` = use bridge default. */
  velocity: number | null
}

/**
 * Immutable builder that emits a chord progression from roman numerals.
 *
 * Sequences chords by applying a {@link RomanBuilder} for each numeral. Chords emit
 * sequentially; each advances the bridge tick. Use {@link VoiceLeadBuilder} for
 * voice-led progressions that minimize movement between chords.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * progression(['I', 'IV', 'V', 'I'])             // I–IV–V–I (e.g. C–F–G–C)
 * progression(['I', 'vi', 'IV', 'V']).duration(1)
 * progression(['ii', 'V7', 'I']).velocity(900)     // ii–V7–I jazz cadence
 * progression(['I']).apply(bridge)                // Single chord
 * ```
 */
export class ProgressionBuilder implements PipeStep {
  private readonly params: ProgressionParams

  constructor(params: Partial<ProgressionParams> = {}) {
    this.params = {
      numerals: params.numerals ?? [],
      duration: params.duration ?? null,
      velocity: params.velocity ?? null,
    }
  }

  /**
   * Set the chord progression (ordered roman numerals).
   *
   * @param numerals - Array of roman numerals (e.g. ['I', 'IV', 'V', 'I'])
   *
   * @returns New ProgressionBuilder with the updated numerals
   */
  numerals(numerals: Degree[]): ProgressionBuilder {
    return this.clone({ numerals })
  }

  /**
   * Set per-chord duration in beats.
   *
   * @param duration - Duration in beats
   *
   * @returns New ProgressionBuilder with the updated duration
   */
  duration(duration: number): ProgressionBuilder {
    return this.clone({ duration })
  }

  /**
   * Set velocity for all chords in the progression.
   *
   * @param velocity - Velocity value (0–1000)
   *
   * @returns New ProgressionBuilder with the updated velocity
   */
  velocity(velocity: number): ProgressionBuilder {
    return this.clone({ velocity })
  }

  /**
   * Emit each chord in the progression sequentially.
   *
   * For each numeral, constructs a RomanBuilder and applies it to the current bridge.
   * Each chord advances the tick by its duration. Empty numerals array yields unchanged bridge.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with progression chords emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    for (let i = 0; i < this.params.numerals.length; ++i) {
      const builder = new RomanBuilder({
        numeral: this.params.numerals[i],
        duration: this.params.duration,
        velocity: this.params.velocity,
      })

      target = builder.apply(target)
    }

    return target
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<ProgressionParams>): ProgressionBuilder {
    return new ProgressionBuilder({ ...this.params, ...overrides })
  }
}
