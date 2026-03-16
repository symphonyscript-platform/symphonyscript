import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

/**
 * Parameters specific to {@link OffsetBuilder}.
 */
export interface OffsetParams extends PitchStepParams {
  /** Cent offset from the tuning reference (A4 by default). */
  offsetCents: number
}

/**
 * A4 reference in absolute cents from C0.
 * A4 = 4 octaves (4800) + 9 semitones (900) = 5700 cents.
 */
const A4_CENTS = 5700

/**
 * Builder for offset-based pitch emission.
 *
 * Stores a cent offset relative to the tuning reference pitch.
 * At apply-time, resolves to absolute cents:
 * `referenceAbsoluteCents + offsetCents + octaveShift + transposeCents`
 * @example
 * ```ts
 * offset(0)         // The tuning reference itself (A4 by default)
 * offset(100)       // 100 cents above reference
 * offset(-50)       // 50 cents below reference
 * ```
 */
export class OffsetBuilder extends PitchStepBuilder<OffsetBuilder> {
  private readonly _offsetCents: number

  constructor(params: Partial<OffsetParams>) {
    super(params)
    this._offsetCents = params.offsetCents ?? 0
  }

  /**
   * Resolve the offset to absolute cents and emit as a note.
   *
   * Resolution pipeline:
   * 1. Absolute cents = A4_CENTS + offsetCents
   * 2. Apply octave shift: + (octaveShift × 1200)
   * 3. Apply accidental (already in cents)
   * 4. Apply transposeCents
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    // Resolve absolute cents
    // Accidental is already in cents (sharp=+100, flat=-100)
    const absoluteCents = A4_CENTS
      + this._offsetCents
      + (this.shared.octaveShift * 1200)
      + this.shared.accidental
      + this.shared.transposeCents

    let target = this.applyFlags(bridge)

    const scaledDuration = this.resolvedDuration()

    for (let i = 0; i < this.shared.repeatCount; ++i) {
      target = target.withNote(
        absoluteCents,
        scaledDuration,
        this.shared.velocity ?? undefined,
      )
    }

    return this.resetFlags(target)
  }

  /** @internal */
  protected create(params: Partial<PitchStepParams>): OffsetBuilder {
    return new OffsetBuilder({ ...params, offsetCents: this._offsetCents })
  }
}
