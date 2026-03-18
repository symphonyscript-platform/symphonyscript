import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { degreeToCents } from '@symphonyscript/theory-legacy'

/**
 * Parameters for {@link DegreeChordBuilder}.
 *
 * A chord is formed from a list of scale degrees resolved in the bridge's scale context.
 */
export interface DegreeChordParams {
  /** Scale degrees (1–7) defining the chord (e.g. [1, 3, 5] = triad). */
  degrees: number[]
  /** Note duration in ticks. `null` = use bridge default at apply-time. */
  duration: number | null
}

/**
 * Immutable builder that emits a chord from scale degrees.
 *
 * Resolves each degree to pitch in cents via `degreeToCents` using the bridge's
 * `scaleIntervals` and `scaleRootCents`. Emits all chord tones simultaneously
 * at the current tick.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * degreeChord([1, 3, 5])                    // Tonic triad (C, E, G in C major)
 * degreeChord([1, 3, 5, 7]).duration(480)   // Major 7th chord, half-note
 * degreeChord([4, 6, 8])                   // IV chord (F, A, C)
 * degreeChord([2, 4, 6], 240)              // ii chord, quarter-note
 * degreeChord([]).apply(bridge)             // No-op (empty degrees)
 * ```
 */
export class DegreeChordBuilder implements PipeStep {
  private readonly params: DegreeChordParams

  constructor(params: Partial<DegreeChordParams>) {
    this.params = {
      degrees: params.degrees ?? [],
      duration: params.duration ?? null,
    }
  }

  /**
   * Set the scale degrees that define the chord.
   *
   * @param degrees - Array of scale degrees (e.g. [1, 3, 5] for triad)
   *
   * @returns New DegreeChordBuilder with the updated degrees
   */
  degrees(degrees: number[]): DegreeChordBuilder {
    return this.clone({ degrees })
  }

  /**
   * Set note duration in ticks.
   *
   * @param duration - Duration in ticks
   *
   * @returns New DegreeChordBuilder with the updated duration
   */
  duration(duration: number): DegreeChordBuilder {
    return this.clone({ duration })
  }

  /**
   * Resolve degrees to pitches (cents) and emit all chord tones simultaneously.
   *
   * Uses `degreeToCents` with `bridge.scaleIntervals` to resolve each degree.
   * Returns bridge unchanged when degrees array is empty or scaleIntervals is null.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with chord notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.degrees.length === 0) return bridge

    const intervals = bridge.scaleIntervals
    if (intervals === null) return bridge

    const startTick = bridge.tick
    const resolvedDuration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.degrees.length; ++i) {
      const cents = bridge.scaleRootCents
        + degreeToCents(intervals as number[], this.params.degrees[i])

      target = target
        .withTick(startTick)
        .withNote(cents, resolvedDuration, undefined)
    }

    target = target.withTick(startTick + resolvedDuration)

    return target
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<DegreeChordParams>): DegreeChordBuilder {
    return new DegreeChordBuilder({ ...this.params, ...overrides })
  }
}
