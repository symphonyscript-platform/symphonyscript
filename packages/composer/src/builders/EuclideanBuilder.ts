import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { applyBinaryPattern } from '../utils/binary-pattern'
import { generateEuclideanPattern } from '../utils/euclidean-pattern'
import { NotePitch } from '@symphonyscript/core'

/**
 * Parameters for {@link EuclideanBuilder}.
 *
 * Used when constructing or cloning an euclidean rhythm builder.
 */
export interface EuclideanParams {
  /** Number of pulses (k) to distribute across steps. Defaults to 1. */
  hits: number
  /** Total steps (n) in the pattern. Defaults to 4. */
  steps: number
  /** Pitches to cycle through on hits. Resolved via notation.noteToCents() at apply-time. Defaults to []. */
  notes: NotePitch[]
  /** Duration per step in beats. `null` uses bridge default. */
  stepDuration: number | null
  /** Fixed velocity for emitted notes. `null` uses bridge default. */
  velocity: number | null
  /** Rotation offset. Positive = right, negative = left. Defaults to 0. */
  rotation: number
  /** Number of times to repeat the pattern. Defaults to 1. */
  repeatCount: number
  /** Optional seed for deterministic rotation. `null` when unused. */
  seed: number | null
}

/**
 * Immutable builder for euclidean rhythms over pitched notes.
 *
 * Distributes a number of hits evenly across steps using Bjorklund's algorithm via
 * {@link generateEuclideanPattern}, then applies the binary pattern with
 * {@link applyBinaryPattern}. Cycles through the notes array on each hit.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * euclidean(3, 8).notes(['C4', 'E4'])                    // Tresillo, alternating C4/E4
 * euclidean(5, 8).notes(['C4']).rotation(1)              // Cinquillo rotated
 * euclidean(3, 8).notes(['C4']).stepDuration(0.5)        // Custom step length
 * euclidean(3, 8).notes(['C4']).repeat(2).velocity(800)  // Play twice, fixed velocity
 * euclidean(3, 8).notes([60, 64]).apply(bridge)         // pitches via notation.noteToCents()
 * ```
 */
export class EuclideanBuilder implements PipeStep {
  private readonly params: EuclideanParams

  constructor(params: Partial<EuclideanParams>) {
    this.params = {
      hits: params.hits ?? 1,
      steps: params.steps ?? 4,
      notes: params.notes ?? [],
      stepDuration: params.stepDuration ?? null,
      velocity: params.velocity ?? null,
      rotation: params.rotation ?? 0,
      repeatCount: params.repeatCount ?? 1,
      seed: params.seed ?? null,
    }
  }

  /**
   * Set the pitched notes to cycle through on hits.
   *
   * @param notes - Array of {@link NotePitch} values (strings or MIDI numbers). Resolved via notation.noteToCents().

   * @returns New builder with the updated notes
   */
  notes(notes: NotePitch[]): EuclideanBuilder {
    return this.clone({ notes })
  }

  /**
   * Set the number of pulses (k) to distribute across steps.
   *
   * @param hits - Number of hits. Must be ≥ 0; `hits = 0` yields no hits.

   * @returns New builder with the updated hits
   */
  hits(hits: number): EuclideanBuilder {
    return this.clone({ hits })
  }

  /**
   * Set the total number of steps (n) in the pattern.
   *
   * @param steps - Step count. Must be > 0; invalid values yield `null` from generateEuclideanPattern.

   * @returns New builder with the updated steps
   */
  steps(steps: number): EuclideanBuilder {
    return this.clone({ steps })
  }

  /**
   * Set the duration in beats for each step.
   *
   * @param stepDuration - Beats per step

   * @returns New builder with the updated step duration
   */
  stepDuration(stepDuration: number): EuclideanBuilder {
    return this.clone({ stepDuration })
  }

  /**
   * Set a fixed velocity for all emitted notes.
   *
   * @param velocity - Velocity (0–1000)

   * @returns New builder with the updated velocity
   */
  velocity(velocity: number): EuclideanBuilder {
    return this.clone({ velocity })
  }

  /**
   * Set the rotation offset. Positive rotates the pattern right, negative left.
   *
   * @param rotation - Offset in steps. Wraps via modulo in generateEuclideanPattern.

   * @returns New builder with the updated rotation
   */
  rotation(rotation: number): EuclideanBuilder {
    return this.clone({ rotation })
  }

  /**
   * Set the number of times to repeat the pattern.
   *
   * @param count - Repeat count

   * @returns New builder with the updated repeat count
   */
  repeat(count: number): EuclideanBuilder {
    return this.clone({ repeatCount: count })
  }

  /**
   * Set an optional seed for deterministic rotation behaviour.
   *
   * @param seed - Numeric seed (currently stored only; resolution depends on generateEuclideanPattern).

   * @returns New builder with the updated seed
   */
  seed(seed: number): EuclideanBuilder {
    return this.clone({ seed })
  }

  /**
   * Generate the euclidean pattern via {@link generateEuclideanPattern} and apply it
   * to the bridge using {@link applyBinaryPattern}.
   *
   * Cycles through the notes array on each hit; uses stepDuration or bridge default; repeats
   * the pattern repeatCount times. Returns the bridge unchanged if pattern generation fails
   * or notes resolve to empty.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with notes emitted on pattern hits
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const pattern = generateEuclideanPattern(
      this.params.hits,
      this.params.steps,
      this.params.rotation,
    )

    if (pattern === null) return bridge

    const notation = bridge.notation()
    const pitches = this.params.notes.map(p => notation.noteToCents(p))
    if (pitches.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.repeatCount; ++i) {
      target = applyBinaryPattern(pattern, pitches, duration, target, this.params.velocity ?? undefined)
    }

    return target
  }

  /** @internal Creates a new EuclideanBuilder with merged params. */
  private clone(overrides: Partial<EuclideanParams>): EuclideanBuilder {
    return new EuclideanBuilder({ ...this.params, ...overrides })
  }
}
