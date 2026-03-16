import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

/**
 * Parameters for {@link TremoloBuilder}.
 *
 * Used by {@link tremolo} cue; all fields default to `null` and are
 * resolved at apply-time from the bridge when unset.
 */
export interface TremoloParams {
  /** Single pitch repeated. Resolved via {@link resolvePitch}. */
  pitch: NotePitch | null
  /** Tick interval between repeated notes. `null` = bridge.defaultDuration. */
  rate: number | null
  /** Total tremolo duration in ticks. `null` = bridge.defaultDuration. */
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
 * tremolo('C4', 120, 480)                  // 4 hits at 120 ticks each
 * tremolo('G4').rate(240).duration(960)    // Chain overrides
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
   * Set the tick interval between repeated notes.
   *
   * @param rate - Ticks per note

   * @returns New TremoloBuilder with the updated rate
   */
  rate(rate: number): TremoloBuilder {
    return this.clone({ rate })
  }

  /**
   * Set the pitch to repeat.
   *
   * @param pitch - Literal note name or MIDI number

   * @returns New TremoloBuilder with the updated pitch
   */
  pitch(pitch: NotePitch): TremoloBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the total tremolo duration in ticks.
   *
   * @param duration - Total duration in ticks

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

   * @returns Updated bridge with tremolo notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const midi = resolvePitch(this.params.pitch)
    const rate = this.params.rate ?? bridge.defaultDuration
    const duration = this.params.duration ?? bridge.defaultDuration

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(midi, rate)
    }

    return target
  }

  /** @internal */
  private clone(overrides: Partial<TremoloParams>): TremoloBuilder {
    return new TremoloBuilder({ ...this.params, ...overrides })
  }
}
