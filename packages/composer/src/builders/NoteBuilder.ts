import { CompositionBridge } from '@symphonyscript/composer'
import type { NoteName } from '@symphonyscript/core'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'


/**
 * Parameters specific to {@link NoteBuilder}.
 *
 * Extends {@link PitchStepParams} with pitch resolution fields.
 */
export interface NoteParams extends PitchStepParams {
  /** Pre-resolved pitch in absolute cents from C0. Defaults to 6000 (C4). */
  pitchCents: number
  /**
   * Original string pitch cue (e.g. `'C4'`, `'F#5'`).
   * Retained for notation-aware re-resolution at apply-time.
   * `null` when the pitch was provided as a number.
   */
  rawPitch: NoteName | null
}

/**
 * Immutable builder for single-note emission.
 *
 * Resolves pitch through a cents pipeline:
 * 1. If `rawPitch` is set → resolve via `notation.noteToCents()`
 * 2. If numeric input → use as absolute cents directly
 * 3. Final = resolved + accidental + (octaveShift × 1200) + transposeCents
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * note('C4')                          // C4 via notation
 * note('C4').sharp()                  // C#4
 * note('C4').up(2).velocity(900)      // C6, velocity 900
 * note(6000)                          // C4 via absolute cents
 * note('F4').repeat(3)               // Emits F4 three times sequentially
 * ```
 */
export class NoteBuilder extends PitchStepBuilder<NoteBuilder> {
  private readonly _pitchCents: number
  private readonly _rawPitch: NoteName | null

  constructor(params: Partial<NoteParams>) {
    super(params)
    this._pitchCents = params.pitchCents ?? 6000 // C4
    this._rawPitch = params.rawPitch ?? null
  }

  /**
   * Override the pitch directly in absolute cents. Clears `rawPitch`
   * since string resolution no longer applies.
   *
   * @param cents - Absolute cents from C0 (e.g. 6000 = C4)
   *
   * @returns New NoteBuilder with the updated pitch
   */
  pitch(cents: number): NoteBuilder {
    return new NoteBuilder({ ...this.shared, pitchCents: cents, rawPitch: null })
  }

  /**
   * Resolve the final pitch in cents and emit the note onto the bridge.
   *
   * **Pitch resolution:**
   * 1. Raw string pitch → `notation.noteToCents()` resolves to cents
   * 2. Numeric pitch → used directly as absolute cents
   * 3. Final = resolved + accidental + (octaveShift × 1200) + transposeCents
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with note(s) emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let resolvedCents = this._pitchCents

    if (this._rawPitch !== null) {
      // Resolve note name → cents via the bridge's notation
      resolvedCents = bridge.notation().noteToCents(this._rawPitch)
    }

    // For raw string pitches with accidental override, the accidental is
    // handled via the override mechanism (sharp/flat/natural).
    // For numeric pitches, accidental is applied as a cent offset.
    const accidentalCents = this._rawPitch !== null ? 0 : this.shared.accidental

    const finalCents = resolvedCents
      + accidentalCents
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

  /** @internal Creates a new NoteBuilder preserving pitch state. */
  protected create(params: Partial<PitchStepParams>): NoteBuilder {
    return new NoteBuilder({ ...params, pitchCents: this._pitchCents, rawPitch: this._rawPitch })
  }
}
