import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Parameters for {@link RollBuilder}.
 *
 * Used by {@link roll} cue for buzz rolls; pitch is typically a GM drum
 * MIDI key (e.g. {@link GM_DRUM.BASS_DRUM_1}).
 */
export interface RollParams {
  /** Pitch in cents (typically drum key). */
  pitch: number | null
  /** Total roll duration in ticks. `null` = bridge.defaultDuration. */
  duration: number | null
  /** Tick interval per hit. `null` = bridge.defaultDuration / 4. */
  rate: number | null
}

/**
 * Immutable builder for roll (fast repeated hits over a duration).
 *
 * Emits the same MIDI pitch repeatedly, typically used for drum buzz rolls.
 * Hit count = `floor(duration / rate)`. Rate defaults to quarter of the bridge's
 * default duration when not set.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * roll(GM_DRUM.BASS_DRUM_1)                // Bass drum buzz (duration/rate from bridge)
 * roll(GM_DRUM.ACOUSTIC_SNARE, 480, 120)   // Snare roll, 480 ticks, 120 per hit
 * roll(36).duration(240).rate(60)          // Chain overrides
 * roll(GM_DRUM.COWBELL).apply(bridge)      // Emit onto composition
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
   * Set the total roll duration in ticks.
   *
   * @param duration - Total duration in ticks

   * @returns New RollBuilder with the updated duration
   */
  duration(duration: number): RollBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the tick interval per hit.
   *
   * @param rate - Ticks per hit

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

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(this.params.pitch, hitDuration)
    }

    return target
  }

  /** @internal */
  private clone(overrides: Partial<RollParams>): RollBuilder {
    return new RollBuilder({ ...this.params, ...overrides })
  }
}
