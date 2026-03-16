import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

/**
 * Parameters for {@link DegreeBuilder}.
 *
 * Extends {@link PitchStepParams} with scale degree (1–7, 0 or 8 = tonic variants).
 */
export interface DegreeParams extends PitchStepParams {
  /** Scale degree (1–7; 0 or 8 resolve to tonic). Default: 1. */
  degree: number
}

/**
 * Immutable builder that emits a single pitch from a scale degree.
 *
 * Resolves the degree to MIDI pitch using the bridge's scale context (scaleRoot, scaleMode)
 * via `degreeToPitch`. Inherits velocity, duration, accidentals, octave shift, transpose,
 * repeat, and articulations from {@link PitchStepBuilder}.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * degree(1)                           // Tonic (C4 in C major)
 * degree(5).velocity(1000)             // Dominant, louder
 * degree(3).up(1).duration(480)        // Mediant an octave up, half-note
 * degree(1).repeat(3)                  // Emit tonic three times
 * degree(7).sharp().apply(bridge)      // Leading tone with accidental
 * ```
 */
export class DegreeBuilder extends PitchStepBuilder<DegreeBuilder> {
  private readonly _degree: number

  constructor(params: Partial<DegreeParams>) {
    super(params)
    this._degree = params.degree ?? 1
  }

  /**
   * Set the scale degree. 1 = tonic, 7 = leading tone; 0 or 8 resolve to tonic variants.
   *
   * @param degree - Scale degree (1–7 typical; negative/high values wrap via modulo)
   * @returns New DegreeBuilder with the updated degree
   */
  degree(degree: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.shared, degree })
  }

  /**
   * Resolve the degree to pitch and emit note(s).
   *
   * Calls `degreeToPitch` with bridge scaleRoot, scaleMode, accidental, transpose, octaveShift.
   * Respects repeatCount; each repeat emits at the current tick and advances tick by duration.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with note(s) emitted, or unchanged if degreeToPitch returns null
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const pitch = degreeToPitch(
      this._degree,
      bridge.scaleRoot,
      bridge.scaleMode as ScaleMode,
      4,
      this.shared.accidental + this.shared.transposeSemitones,
      this.shared.octaveShift,
    )

    if (pitch === null) return bridge

    let target = this.applyFlags(bridge)

    const scaledDuration = this.resolvedDuration()

    for (let i = 0; i < this.shared.repeatCount; ++i) {
      target = target.withNote(
        pitch,
        scaledDuration,
        this.shared.velocity ?? undefined,
      )
    }

    return this.resetFlags(target)
  }

  /** @internal Creates a new DegreeBuilder preserving the degree. */
  protected create(params: Partial<PitchStepParams>): DegreeBuilder {
    return new DegreeBuilder({ ...params, degree: this._degree })
  }
}
