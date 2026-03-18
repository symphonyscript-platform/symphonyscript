import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

import { NotePitch } from '@symphonyscript/core'

/**
 * Parameters for {@link TrillBuilder}.
 *
 * Used by {@link trill} cue; all fields default to `null` and are
 * resolved at apply-time from the bridge when unset.
 */
export interface TrillParams {
  /** Upper pitch in the alternation. Resolved via notation.noteToCents(). */
  pitch: NotePitch | null
  /** Base (lower) pitch — alternation starts on this. Resolved via notation.noteToCents(). */
  basePitch: NotePitch | null
  /** Tick interval between alternating notes. `null` = bridge.defaultDuration. */
  rate: number | null
  /** Total trill duration in ticks. `null` = bridge.defaultDuration. */
  duration: number | null
}

/**
 * Immutable builder for trill ornament (rapid alternation between two pitches).
 *
 * Emits notes alternating base → upper → base → upper for the full duration.
 * Hit count = `floor(duration / rate)`. Even indices use basePitch, odd use pitch.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * trill('E4', 'C4')                         // C4, E4, C4, E4... (rate/duration from bridge)
 * trill('E4', 'C4').rate(120).duration(480) // 4 hits at 120 ticks each
 * trill(6400, 6000).basePitch(5900)        // Override pitches in cents
 * trill('E4', 'C4').apply(bridge)           // Emit onto composition
 * ```
 */
export class TrillBuilder implements PipeStep {
  private readonly params: TrillParams

  constructor(params: Partial<TrillParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      basePitch: params.basePitch ?? null,
      rate: params.rate ?? null,
      duration: params.duration ?? null,
    }
  }

  /**
   * Set the base pitch (start of alternation).
   *
   * @param basePitch - Note name or absolute cents
   *
   * @returns New TrillBuilder with the updated base pitch
   */
  basePitch(basePitch: NotePitch): TrillBuilder {
    return this.clone({ basePitch })
  }

  /**
   * Set the upper pitch (alternating note).
   *
   * @param pitch - Note name or absolute cents
   *
   * @returns New TrillBuilder with the updated upper pitch
   */
  pitch(pitch: NotePitch): TrillBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the tick interval between alternating notes.
   *
   * @param rate - Ticks per note
   *
   * @returns New TrillBuilder with the updated rate
   */
  rate(rate: number): TrillBuilder {
    return this.clone({ rate })
  }

  /**
   * Set the total trill duration in ticks.
   *
   * @param duration - Total duration in ticks
   *
   * @returns New TrillBuilder with the updated duration
   */
  duration(duration: number): TrillBuilder {
    return this.clone({ duration })
  }

  /**
   * Emit alternating notes onto the bridge.
   *
   * Hit count = `floor(duration / rate)`. Alternates basePitch (even indices)
   * and pitch (odd indices). Returns bridge unchanged if pitch or basePitch is null.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with trill notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.basePitch === null) return bridge

    const notation = bridge.notation()
    const trillCents = notation.noteToCents(this.params.pitch)
    const baseCents = notation.noteToCents(this.params.basePitch)
    const rate = this.params.rate ?? bridge.defaultDuration
    const duration = this.params.duration ?? bridge.defaultDuration

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      const currentPitch = i % 2 === 0 ? baseCents : trillCents
      target = target.withNote(currentPitch, rate)
    }

    return target
  }

  /** @internal */
  private clone(overrides: Partial<TrillParams>): TrillBuilder {
    return new TrillBuilder({ ...this.params, ...overrides })
  }
}
