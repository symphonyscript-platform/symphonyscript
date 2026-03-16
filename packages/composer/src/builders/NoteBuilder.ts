import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { applyKeySignature, noteToMidi } from '@symphonyscript/theory'
import type { KeyContext } from '@symphonyscript/theory'

/**
 * C0 in MIDI = 12 (MIDI 0 = C-1).
 * To convert MIDI → cents from C0: (midi - 12) * 100
 */
const MIDI_C0 = 12

/**
 * Parameters specific to {@link NoteBuilder}.
 *
 * Extends {@link PitchStepParams} with pitch resolution fields.
 */
export interface NoteParams extends PitchStepParams {
  /** Pre-resolved pitch in absolute cents from C0. Defaults to 4800 (C4). */
  pitchCents: number
  /**
   * Original string pitch cue (e.g. `'C4'`, `'F#5'`).
   * Retained for temperament-aware re-resolution at apply-time.
   * `null` when the pitch was provided as a number.
   */
  rawPitch: string | null
}

/**
 * Immutable builder for single-note emission.
 *
 * Resolves pitch through a multi-stage cents pipeline:
 * 1. If `rawPitch` is set and bridge has key context → apply key signature
 * 2. Resolve note name to MIDI → convert to cents (temporary until theory has noteToCents)
 * 3. If bridge has temperament → re-resolve using temperament intervals
 * 4. If numeric input → use as absolute cents directly
 * 5. Final = resolved + accidental + (octaveShift × 1200) + transposeCents
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * note('C4')                          // C4 = 4800 cents
 * note('C4').sharp()                  // C#4 = 4900 cents
 * note('C4').up(2).velocity(900)      // C6 = 7200 cents, velocity 900
 * note(4800)                          // C4 via absolute cents
 * note('F4').repeat(3)               // Emits F4 three times sequentially
 * ```
 */
export class NoteBuilder extends PitchStepBuilder<NoteBuilder> {
  private readonly _pitchCents: number
  private readonly _rawPitch: string | null

  constructor(params: Partial<NoteParams>) {
    super(params)
    this._pitchCents = params.pitchCents ?? 4800 // C4
    this._rawPitch = params.rawPitch ?? null
  }

  /**
   * Override the pitch directly in absolute cents. Clears `rawPitch`
   * since string resolution no longer applies.
   *
   * @param cents - Absolute cents from C0 (e.g. 4800 = C4)
   *
   * @returns New NoteBuilder with the updated pitch
   */
  pitch(cents: number): NoteBuilder {
    return new NoteBuilder({ ...this.shared, pitchCents: cents, rawPitch: null })
  }

  /**
   * Resolve the final pitch in cents and emit the note onto the bridge.
   *
   * **Pitch resolution order:**
   * 1. Raw string pitch + key context → `applyKeySignature` → `noteToMidi` → cents
   * 2. Raw string pitch + `.natural()` → strip accidentals → `noteToMidi` → cents
   * 3. Raw string pitch (no key context) → use pre-resolved cents
   * 4. Numeric pitch → used directly as absolute cents
   * 5. Final = resolved + accidental + (octaveShift × 1200) + transposeCents
   *
   * Emits `repeatCount` notes at the resolved pitch, each advancing the tick.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with note(s) emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let resolvedCents = this._pitchCents

    if (this._rawPitch !== null) {
      if (bridge.keyRoot !== null) {
        const keyContext: KeyContext = {
          root: bridge.keyRoot,
          mode: bridge.keyMode,
        }
        const adjusted = applyKeySignature(
          this._rawPitch,
          keyContext,
          this.shared.accidentalOverride ?? undefined,
        )
        if (adjusted !== null) {
          const midi = noteToMidi(adjusted)
          if (midi !== null) {
            resolvedCents = (midi - MIDI_C0) * 100
          }
        }
      } else if (this.shared.accidentalOverride === 'natural') {
        const adjusted = applyKeySignature(this._rawPitch, null, 'natural')
        if (adjusted !== null) {
          const midi = noteToMidi(adjusted)
          if (midi !== null) {
            resolvedCents = (midi - MIDI_C0) * 100
          }
        }
      }
    }

    // Accidental is already in cents (sharp = +100, flat = -100).
    // For raw string pitches, accidentalOverride handles key-signature logic above,
    // so we skip the numeric accidental offset to avoid double-counting.
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
