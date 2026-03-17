import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToCents } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

/**
 * Parameters for {@link DegreeBuilder}.
 *
 * Extends {@link PitchStepParams} with scale degree (1–7, 8 = tonic above, 0 = 7th below).
 */
export interface DegreeParams extends PitchStepParams {
  /** Scale degree (1–7; 8 = tonic octave above; 0 = 7th degree one octave below). Default: 1. */
  degree: number
}

/**
 * Immutable builder that emits a single pitch from a scale degree.
 *
 * Resolves via `degreeToCents()` using the bridge's `scaleIntervals`
 * and `scaleRootCents`.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * degree(1)                           // Tonic
 * degree(5).velocity(1000)             // Dominant, louder
 * degree(3).up(1).duration(480)        // Mediant an octave up, half-note
 * degree(1).repeat(3)                  // Emit tonic three times
 * degree(7).sharp().apply(bridge)      // Leading tone sharpened (+100 cents)
 * ```
 */
export class DegreeBuilder extends PitchStepBuilder<DegreeBuilder> {
  private readonly _degree: number

  constructor(params: Partial<DegreeParams>) {
    super(params)
    this._degree = params.degree ?? 1
  }

  /**
   * Set the scale degree. 1 = tonic, 7 = leading tone; 8 = tonic octave above; 0 = 7th degree one octave below.
   *
   * @param degree - Scale degree (1–7 typical; 8 = tonic above; 0 = 7th below; negative/high values wrap via modulo)
   *
   * @returns New DegreeBuilder with the updated degree
   */
  degree(degree: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.shared, degree })
  }

  /**
   * Resolve the degree to pitch in cents and emit note(s).
   *
   * Uses `degreeToCents()` with the bridge's `scaleIntervals` to compute
   * the cent offset, then adds `scaleRootCents` and modifiers.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with note(s) emitted, or unchanged if no scale intervals
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const intervals = bridge.scaleIntervals
    if (intervals === null) return bridge

    const degreeCents = degreeToCents(intervals, this._degree)
    const finalCents = bridge.scaleRootCents
      + degreeCents
      + this.shared.accidental
      + (this.shared.octaveShift * 1200)
      + this.shared.transposeCents

    let target = this.applyFlags(bridge)
    const scaledDuration = this.resolvedDuration()

    for (let i = 0; i < this.shared.repeatCount; ++i) {
      target = target.withNote(
        finalCents,
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
