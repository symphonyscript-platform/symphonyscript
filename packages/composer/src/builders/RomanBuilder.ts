import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { RomanNumeral } from '@symphonyscript/theory'
import { degreeToPitch, ROMAN_DEGREE_MAP, ScaleMode } from '@symphonyscript/theory'

/**
 * Parameters for {@link RomanBuilder}.
 *
 * Resolves roman numerals to diatonic scale degrees via {@link ROMAN_DEGREE_MAP}.
 */
export interface RomanParams {
  /** Roman numeral (e.g. I, iv, V7). Must exist in ROMAN_DEGREE_MAP. */
  numeral: RomanNumeral
  /** Note duration in ticks. `null` = use bridge default at apply-time. */
  duration: number | null
  /** Inversion index (0 = root, 1 = first inversion, etc.). Default: 0. */
  inversion: number
  /** Velocity override. `null` = use bridge default. */
  velocity: number | null
}

/**
 * Immutable builder that emits chord tones from a roman numeral.
 *
 * Maps numerals (I, iv, V7, etc.) to diatonic scale degrees via {@link ROMAN_DEGREE_MAP},
 * resolves degrees to MIDI pitches using the bridge's scale context (scaleRoot, scaleMode),
 * and emits simultaneous notes. Supports inversions by rotating bottom notes up one octave.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * roman('I')                          // Tonic triad (C, E, G in C major)
 * roman('V7').duration(480)           // Dominant 7th, half-note
 * roman('vi').velocity(900)           // Submediant minor, louder
 * roman('ii').inversion(1)            // First inversion (third in bass)
 * roman('IV', 240).apply(bridge)      // Subdominant, quarter-note
 * ```
 */
export class RomanBuilder implements PipeStep {
  private readonly params: RomanParams

  constructor(params: Partial<RomanParams>) {
    this.params = {
      numeral: params.numeral ?? 'I',
      duration: params.duration ?? null,
      inversion: params.inversion ?? 0,
      velocity: params.velocity ?? null,
    }
  }

  /**
   * Set the roman numeral. Must exist in {@link ROMAN_DEGREE_MAP}.
   *
   * @param numeral - Roman numeral (e.g. I, iv, V7, ii, bVII)
   * @returns New RomanBuilder with the updated numeral
   * @throws When numeral is not in ROMAN_DEGREE_MAP (lookup yields undefined)
   */
  numeral(numeral: RomanNumeral): RomanBuilder {
    return this.clone({ numeral })
  }

  /**
   * Set note duration in ticks.
   *
   * @param duration - Duration in ticks
   * @returns New RomanBuilder with the updated duration
   */
  duration(duration: number): RomanBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the inversion index. Rotates bottom voices up by 7 diatonic degrees (one octave).
   *
   * @param inversion - Inversion count (0 = root position)
   * @returns New RomanBuilder with the updated inversion
   */
  inversion(inversion: number): RomanBuilder {
    return this.clone({ inversion })
  }

  /**
   * Set velocity for emitted chord tones.
   *
   * @param velocity - Velocity value (millivels 0–1270)
   * @returns New RomanBuilder with the updated velocity
   */
  velocity(velocity: number): RomanBuilder {
    return this.clone({ velocity })
  }

  /**
   * Resolve the numeral to scale degrees, apply inversion, and emit all chord tones.
   *
   * Lookups `ROMAN_DEGREE_MAP[numeral]` for base degrees, rotates by inversion,
   * resolves each degree via `degreeToPitch` with bridge scale context, then emits
   * notes at the bridge tick. Advances tick by duration after emission.
   *
   * @param bridge - Current composition state (scaleRoot, scaleMode, tick)
   * @returns Updated bridge with chord notes emitted
   * @throws When numeral is not in ROMAN_DEGREE_MAP
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const baseDegrees = ROMAN_DEGREE_MAP[this.params.numeral]

    // Apply inversion: rotate bottom notes up by 7 degrees (one octave in diatonic)
    const degrees: number[] = new Array(baseDegrees.length)
    const scaleMode = bridge.scaleMode as ScaleMode
    const inversionCount = Math.min(this.params.inversion, baseDegrees.length)

    for (let i = 0; i < baseDegrees.length; ++i) {
      const rotatedIndex = (i + inversionCount) % baseDegrees.length
      const octaveBoost = (i + inversionCount) >= baseDegrees.length ? 7 : 0
      degrees[i] = baseDegrees[rotatedIndex] + octaveBoost
    }

    // Resolve degrees to pitches
    const startTick = bridge.tick
    const duration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < degrees.length; ++i) {
      const pitch = degreeToPitch(
        degrees[i],
        bridge.scaleRoot,
        scaleMode,
        4,
      )

      if (pitch === null) continue

      target = target
        .withTick(startTick)
        .withNote(pitch, duration, this.params.velocity ?? undefined)
    }

    target = target.withTick(startTick + duration)

    return target
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<RomanParams>): RomanBuilder {
    return new RomanBuilder({ ...this.params, ...overrides })
  }
}
