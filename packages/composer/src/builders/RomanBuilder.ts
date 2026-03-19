import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Degree, ChordIntervals } from '@symphonyscript/core'

/**
 * Parameters for {@link RomanBuilder}.
 *
 * Resolves roman numerals via the bridge's notation (degreeToCents / resolveProgression).
 */
export interface RomanParams {
  /** Roman numeral (e.g. I, iv, V7). Resolved via notation.resolveProgression(). */
  numeral: Degree
  /** Note duration in beats. `null` = use bridge default at apply-time. */
  duration: number | null
  /** Inversion index (0 = root, 1 = first inversion, etc.). Default: 0. */
  inversion: number
  /** Velocity override. `null` = use bridge default. */
  velocity: number | null
}

/**
 * Immutable builder that emits chord tones from a roman numeral.
 *
 * Resolves the numeral via `bridge.notation().resolveProgression()` to obtain
 * root cents and chord intervals, then emits all chord tones simultaneously.
 * Supports inversions by rotating bottom intervals up one octave (+1200 cents).
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * roman('I')                          // Tonic triad
 * roman('V7').duration(1)           // Dominant 7th, quarter-note
 * roman('vi').velocity(900)           // Submediant minor, louder
 * roman('ii').inversion(1)            // First inversion (third in bass)
 * roman('IV', 0.5).apply(bridge)      // Subdominant, eighth-note
 * ```
 */
export class RomanBuilder implements PipeStep {
  private readonly params: RomanParams

  constructor(params: Partial<RomanParams>) {
    this.params = {
      numeral: params.numeral ?? 'I' as Degree,
      duration: params.duration ?? null,
      inversion: params.inversion ?? 0,
      velocity: params.velocity ?? null,
    }
  }

  /**
   * Set the roman numeral. Resolved via `notation.resolveProgression()`.
   *
   * @param numeral - Roman numeral (e.g. I, iv, V7, ii, bVII)
   *
   * @returns New RomanBuilder with the updated numeral
   */
  numeral(numeral: Degree): RomanBuilder {
    return this.clone({ numeral })
  }

  /**
   * Set note duration in beats.
   *
   * @param duration - Duration in beats
   *
   * @returns New RomanBuilder with the updated duration
   */
  duration(duration: number): RomanBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the inversion index. Rotates bottom intervals up by 1200 cents (one octave).
   *
   * @param inversion - Inversion count (0 = root position)
   *
   * @returns New RomanBuilder with the updated inversion
   */
  inversion(inversion: number): RomanBuilder {
    return this.clone({ inversion })
  }

  /**
   * Set velocity for emitted chord tones.
   *
   * @param velocity - Velocity value (0–1000)
   *
   * @returns New RomanBuilder with the updated velocity
   */
  velocity(velocity: number): RomanBuilder {
    return this.clone({ velocity })
  }

  /**
   * Resolve the numeral to chord tones via the notation, apply inversion, and emit.
   *
   * Uses `notation.resolveProgression()` to get `{ rootCents, intervals }` for the
   * numeral, then applies inversion by rotating bottom intervals up +1200 cents.
   *
   * @param bridge - Current composition state (scaleIntervals, scaleRootCents, tick)
   *
   * @returns Updated bridge with chord notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const scale = bridge.scaleIntervals
    if (scale === null) return bridge

    const [resolution] = bridge.notation().resolveProgression(
      [this.params.numeral],
      scale as number[],
    )

    // Apply inversion: rotate bottom intervals up by +1200 cents
    const intervals = this.invertIntervals(resolution.intervals, this.params.inversion)

    const rootCents = bridge.scaleRootCents + resolution.rootCents
    const startTick = bridge.tick
    const duration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < intervals.length; ++i) {
      target = target
        .withTick(startTick)
        .withNote(rootCents + intervals[i], duration, this.params.velocity ?? undefined)
    }

    target = target.withTick(startTick + duration)

    return target
  }

  /**
   * Rotate bottom intervals up by 1200 cents for inversion.
   *
   * E.g. [0, 400, 700] with inversion=1 → [400, 700, 1200]
   *      (root moves up an octave, third becomes bass)
   */
  private invertIntervals(intervals: ChordIntervals, inversion: number): number[] {
    const result = [...intervals]
    const count = Math.min(inversion, result.length)

    for (let i = 0; i < count; ++i) {
      result.push(result.shift()! + 1200)
    }

    return result
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<RomanParams>): RomanBuilder {
    return new RomanBuilder({ ...this.params, ...overrides })
  }
}
