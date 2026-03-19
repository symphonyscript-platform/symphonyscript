import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

import { NotePitch } from '@symphonyscript/core'

/**
 * Parameters for {@link TremoloBuilder}.
 *
 * Used by {@link tremolo} cue; all fields default to `null` and are
 * resolved at apply-time from the bridge when unset.
 */
export interface TremoloParams {
  /** Single pitch repeated. Resolved via notation.noteToCents(). */
  pitch: NotePitch | null
  /** Beat interval between repeated notes. `null` = bridge.defaultDuration. */
  rate: number | null
  /** Total tremolo duration in beats. `null` = bridge.defaultDuration. */
  duration: number | null
}

/**
 * Immutable builder for tremolo (rapid repetition of the same note).
 *
 * Emits the same pitch repeatedly over the given duration. Repeat count =
 * `floor(duration / rate)`.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * tremolo('C4')                            // C4 repeated (rate/duration from bridge)
 * tremolo('C4', 0.25, 1)                  // 4 hits at 0.25 beats each
 * tremolo('G4').rate(0.5).duration(2)    // Chain overrides
 * tremolo('E4').apply(bridge)              // Emit onto composition
 * ```
 */
export class TremoloBuilder implements PipeStep {
  private readonly params: TremoloParams

  constructor(params: Partial<TremoloParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      rate: params.rate ?? null,
      duration: params.duration ?? null,
    }
  }

  /**
   * Set the beat interval between repeated notes.
   *
   * @param rate - Beats per note
   *
   * @returns New TremoloBuilder with the updated rate
   */
  rate(rate: number): TremoloBuilder {
    return this.clone({ rate })
  }

  /**
   * Set the pitch to repeat.
   *
   * @param pitch - Note name or absolute cents
   *
   * @returns New TremoloBuilder with the updated pitch
   */
  pitch(pitch: NotePitch): TremoloBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the total tremolo duration in beats.
   *
   * @param duration - Total duration in beats
   *
   * @returns New TremoloBuilder with the updated duration
   */
  duration(duration: number): TremoloBuilder {
    return this.clone({ duration })
  }

  /**
   * Emit repeated notes onto the bridge.
   *
   * Repeat count = `floor(duration / rate)`. Returns bridge unchanged if pitch is null.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with tremolo notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const cents = bridge.notation().noteToCents(this.params.pitch)
    const rate = this.params.rate ?? bridge.defaultDuration
    const duration = this.params.duration ?? bridge.defaultDuration

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(cents, rate)
    }

    return target
  }

  /** @internal */
  private clone(overrides: Partial<TremoloParams>): TremoloBuilder {
    return new TremoloBuilder({ ...this.params, ...overrides })
  }
}
