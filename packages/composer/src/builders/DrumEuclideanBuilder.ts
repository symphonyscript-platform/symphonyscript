import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { DrumPitch } from '@symphonyscript/core'
import { applyBinaryPattern } from '../utils/binary-pattern'
import { generateEuclideanPattern } from '../utils/euclidean-pattern'

/**
 * Parameters for {@link DrumEuclideanBuilder}.
 */
export interface DrumEuclideanParams {
  /** Number of pulses (k) to distribute. Defaults to 1. */
  hits: number
  /** Total steps (n) in the pattern. Defaults to 4. */
  steps: number
  /** Pitch in cents or drum name. `null` means no emission (apply returns bridge unchanged). */
  pitch: DrumPitch | null
  /** Duration per step in ticks. `null` uses bridge default. */
  stepDuration: number | null
  /** Rotation offset. Positive = right, negative = left. Defaults to 0. */
  rotation: number
}

/**
 * Immutable builder for euclidean drum rhythms (single pitch per hit).
 *
 * Distributes hits across steps via {@link generateEuclideanPattern} and applies them
 * with {@link applyBinaryPattern} using a single drum pitch. Use this for kick/snare-like
 * patterns where each hit is the same sound; for multiple pitches cycling through hits,
 * use {@link EuclideanBuilder}.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * drumEuclidean(3, 8, Drums.BASS_DRUM_1)                // Tresillo kick
 * drumEuclidean(5, 8, Drums.ACOUSTIC_SNARE, 240, 1)     // Cinquillo snare, rotated
 * drumEuclidean(2, 4, 36).steps(8).hits(3)              // Backbeat-style pattern
 * drumEuclidean(3, 8, 42).apply(bridge)
 * ```
 */
export class DrumEuclideanBuilder implements PipeStep {
  private readonly params: DrumEuclideanParams

  constructor(params: Partial<DrumEuclideanParams>) {
    this.params = {
      hits: params.hits ?? 1,
      steps: params.steps ?? 4,
      pitch: params.pitch ?? null,
      stepDuration: params.stepDuration ?? null,
      rotation: params.rotation ?? 0,
    }
  }

  /**
   * Set the pitch for drum hits.
   *
   * @param pitch - Pitch in cents or drum name (e.g. 'kick')

   * @returns New builder with the updated pitch
   */
  pitch(pitch: DrumPitch): DrumEuclideanBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the number of pulses to distribute across steps.
   *
   * @param hits - Number of hits

   * @returns New builder with the updated hits
   */
  hits(hits: number): DrumEuclideanBuilder {
    return this.clone({ hits })
  }

  /**
   * Set the total number of steps in the pattern.
   *
   * @param steps - Step count. Must be > 0.

   * @returns New builder with the updated steps
   */
  steps(steps: number): DrumEuclideanBuilder {
    return this.clone({ steps })
  }

  /**
   * Set the duration in ticks for each step.
   *
   * @param stepDuration - Ticks per step

   * @returns New builder with the updated step duration
   */
  stepDuration(stepDuration: number): DrumEuclideanBuilder {
    return this.clone({ stepDuration })
  }

  /**
   * Set the rotation offset for the pattern.
   *
   * @param rotation - Offset in steps

   * @returns New builder with the updated rotation
   */
  rotation(rotation: number): DrumEuclideanBuilder {
    return this.clone({ rotation })
  }

  /**
   * Generate the euclidean pattern via {@link generateEuclideanPattern} and apply it
   * with {@link applyBinaryPattern} using the single drum pitch.
   *
   * Returns the bridge unchanged if pitch is null or pattern generation fails.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with drum hits on pattern positions
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const pattern = generateEuclideanPattern(
      this.params.hits,
      this.params.steps,
      this.params.rotation,
    )

    if (pattern === null) return bridge

    const resolvedPitch = typeof this.params.pitch === 'string'
      ? bridge.notation().drumToCents(this.params.pitch)
      : this.params.pitch

    const duration = this.params.stepDuration ?? bridge.defaultDuration

    return applyBinaryPattern(pattern, [resolvedPitch], duration, bridge)
  }

  /** @internal Creates a new DrumEuclideanBuilder with merged params. */
  private clone(overrides: Partial<DrumEuclideanParams>): DrumEuclideanBuilder {
    return new DrumEuclideanBuilder({ ...this.params, ...overrides })
  }
}
