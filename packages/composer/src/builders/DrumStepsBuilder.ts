import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { applyBinaryPattern } from '../utils/binary-pattern'

/**
 * Parameters for {@link DrumStepsBuilder}.
 */
export interface DrumStepsParams {
  /** Binary step pattern. Truthy (e.g. 1) = hit, falsy (e.g. 0) = rest. Defaults to []. */
  pattern: number[]
  /** MIDI pitch for hits. `null` means no emission. */
  pitch: number | null
  /** Duration per step in ticks. `null` uses bridge default. */
  stepDuration: number | null
}

/**
 * Immutable builder for numeric binary drum patterns.
 *
 * Applies a `number[]` pattern (1 = hit, 0 = rest) via {@link applyBinaryPattern} using
 * a single drum pitch. Use this when you have a pre-computed pattern (e.g. from
 * {@link generateEuclideanPattern}) or custom array. For text cue like `"x.x."`,
 * use {@link DrumPatternBuilder}; for euclidean distribution, use {@link DrumEuclideanBuilder}.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * drumSteps([1, 0, 1, 0], GM_DRUM.BASS_DRUM_1)           // Alternating kicks
 * drumSteps([1, 1, 0, 1, 0, 1, 0, 1], 38, 240)           // Cinquillo-style
 * drumSteps([1, 0, 0, 1, 0, 0, 1, 0], 36)               // Tresillo (same as euclidean(3,8))
 * drumSteps([1, 0, 1]).apply(bridge)
 * ```
 */
export class DrumStepsBuilder implements PipeStep {
  private readonly params: DrumStepsParams

  constructor(params: Partial<DrumStepsParams>) {
    this.params = {
      pattern: params.pattern ?? [],
      pitch: params.pitch ?? null,
      stepDuration: params.stepDuration ?? null,
    }
  }

  /**
   * Set the MIDI pitch for drum hits.
   *
   * @param pitch - MIDI note number (0-127)

   * @returns New builder with the updated pitch
   */
  pitch(pitch: number): DrumStepsBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the binary step pattern.
   *
   * Truthy values (1, non-zero) emit a hit; falsy values (0, false) advance tick only.
   * Pass a boolean[] from {@link generateEuclideanPattern} or a number[] directly.
   *
   * @param pattern - Array of 0/1 or truthy/falsy values

   * @returns New builder with the updated pattern
   */
  pattern(pattern: number[]): DrumStepsBuilder {
    return this.clone({ pattern })
  }

  /**
   * Set the duration in ticks for each step.
   *
   * @param stepDuration - Ticks per step

   * @returns New builder with the updated step duration
   */
  stepDuration(stepDuration: number): DrumStepsBuilder {
    return this.clone({ stepDuration })
  }

  /**
   * Apply the binary pattern via {@link applyBinaryPattern}.
   *
   * Returns the bridge unchanged if pitch is null or pattern is empty.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with drum hits at pattern positions
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.pattern.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration

    return applyBinaryPattern(this.params.pattern, [this.params.pitch], duration, bridge)
  }

  /** @internal Creates a new DrumStepsBuilder with merged params. */
  private clone(overrides: Partial<DrumStepsParams>): DrumStepsBuilder {
    return new DrumStepsBuilder({ ...this.params, ...overrides })
  }
}
