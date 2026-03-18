import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Parameters for {@link DrumPatternBuilder}.
 */
export interface DrumPatternParams {
  /** Text pattern: 'x'/'X' = hit, any other char = rest (advance tick). Defaults to ''. */
  cue: string
  /** Pitch in cents for hits. `null` means no emission. */
  pitch: number | null
  /** Duration per step in ticks. `null` uses bridge default. */
  stepDuration: number | null
}

/**
 * Immutable builder for text-based binary drum patterns.
 *
 * Interprets a string where `x` or `X` = hit and any other character = rest (advance tick).
 * Unlike {@link DrumStepsBuilder}, the pattern is specified as a human-readable string rather
 * than a numeric array. Use for quick cue like `"x.x.x..."` without calling
 * {@link generateEuclideanPattern} or {@link applyBinaryPattern} directly.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * drumPattern('x.x.').pitch(GM_DRUM.BASS_DRUM_1)           // Alternating kick
 * drumPattern('xx', GM_DRUM.ACOUSTIC_SNARE, 240)           // Two snares, 240 ticks/step
 * drumPattern('x..x..x.').pitch(36).stepDuration(120)      // Tresillo-style via string
 * drumPattern('x.x.').apply(bridge)
 * ```
 */
export class DrumPatternBuilder implements PipeStep {
  private readonly params: DrumPatternParams

  constructor(params: Partial<DrumPatternParams>) {
    this.params = {
      cue: params.cue ?? '',
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
  pitch(pitch: number): DrumPatternBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the text-based binary pattern.
   *
   * `x` and `X` emit a hit; any other character advances the tick only (rest).
   *
   * @param cue - Pattern string, e.g. `"x.x.x."` or `"xx..xx.."`

   * @returns New builder with the updated cue
   */
  cue(cue: string): DrumPatternBuilder {
    return this.clone({ cue })
  }

  /**
   * Set the duration in ticks for each pattern step.
   *
   * @param stepDuration - Ticks per step

   * @returns New builder with the updated step duration
   */
  stepDuration(stepDuration: number): DrumPatternBuilder {
    return this.clone({ stepDuration })
  }

  /**
   * Interpret the cue string and emit hits on `x`/`X` positions, advancing tick on rests.
   *
   * Returns the bridge unchanged if pitch is null or cue is empty.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with drum hits at pattern positions
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.cue.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.cue.length; ++i) {
      const character = this.params.cue[i]
      if (character === 'x' || character === 'X') {
        target = target.withNote(this.params.pitch, duration)
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  }

  /** @internal Creates a new DrumPatternBuilder with merged params. */
  private clone(overrides: Partial<DrumPatternParams>): DrumPatternBuilder {
    return new DrumPatternBuilder({ ...this.params, ...overrides })
  }
}
