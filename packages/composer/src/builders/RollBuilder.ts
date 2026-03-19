import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { DrumPitch } from '@symphonyscript/core'

/**
 * Parameters for {@link RollBuilder}.
 *
 * Used by {@link roll} cue for buzz rolls; pitch is typically a drum
 * cent value (e.g. {@link Drums.BASS_DRUM_1}).
 */
export interface RollParams {
  /** Pitch in cents or drum name. */
  pitch: DrumPitch | null
  /** Total roll duration in beats. `null` = bridge.defaultDuration. */
  duration: number | null
  /** Beat interval per hit. `null` = bridge.defaultDuration / 4. */
  rate: number | null
}

/**
 * Immutable builder for roll (fast repeated hits over a duration).
 *
 * Emits the same pitch repeatedly, typically used for drum buzz rolls.
 * Hit count = `floor(duration / rate)`. Rate defaults to quarter of the bridge's
 * default duration when not set.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * roll(Drums.BASS_DRUM_1)                  // Bass drum buzz (duration/rate from bridge)
 * roll(Drums.ACOUSTIC_SNARE, 480, 120)     // Snare roll, 480 ticks, 120 per hit
 * roll(36).duration(240).rate(60)          // Chain overrides
 * roll(Drums.COWBELL).apply(bridge)        // Emit onto composition
 * ```
 */
export class RollBuilder implements PipeStep {
  private readonly params: RollParams

  constructor(params: Partial<RollParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      duration: params.duration ?? null,
      rate: params.rate ?? null,
    }
  }

  /**
   * Set the total roll duration in beats.
   *
   * @param duration - Total duration in beats

   * @returns New RollBuilder with the updated duration
   */
  duration(duration: number): RollBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the beat interval per hit.
   *
   * @param rate - Beats per hit

   * @returns New RollBuilder with the updated rate
   */
  rate(rate: number): RollBuilder {
    return this.clone({ rate })
  }

  /**
   * Emit repeated hits onto the bridge.
   *
   * Hit count = `floor(duration / rate)`. Returns bridge unchanged if pitch is null.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with roll notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const duration = this.params.duration ?? bridge.defaultDuration
    const hitDuration = this.params.rate ?? Math.round(bridge.defaultDuration / 4)
    const hitCount = Math.floor(duration / hitDuration)
    let target = bridge

    const resolvedPitch = typeof this.params.pitch === 'string'
      ? bridge.notation().drumToCents(this.params.pitch)
      : this.params.pitch

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(resolvedPitch, hitDuration)
    }

    return target
  }

  /** @internal */
  private clone(overrides: Partial<RollParams>): RollBuilder {
    return new RollBuilder({ ...this.params, ...overrides })
  }
}
