import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { applyKeySignature, noteToMidi } from '@symphonyscript/theory'
import type { KeyContext } from '@symphonyscript/theory'

/**
 * Parameters specific to {@link NoteBuilder}.
 *
 * Extends {@link PitchStepParams} with pitch resolution fields.
 */
export interface NoteParams extends PitchStepParams {
  /** Resolved MIDI pitch number (0-127). Defaults to 60 (C4). */
  pitch: number
  /**
   * Original string pitch notation (e.g. `'C4'`, `'F#5'`).
   * Retained for key-signature-aware resolution at apply-time.
   * `null` when the pitch was provided as a MIDI number.
   */
  rawPitch: string | null
}

/**
 * Immutable builder for single-note emission.
 *
 * Resolves pitch through a multi-stage pipeline:
 * 1. If `rawPitch` is set and the bridge has a key context → applies key signature
 * 2. If `rawPitch` is set with `.natural()` override → strips accidentals
 * 3. Otherwise → uses the pre-resolved MIDI pitch as-is
 * 4. Adds accidental offset, octave shift, and transpose semitones
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * note('C4')                          // C4 = MIDI 60
 * note('C4').sharp()                  // C#4 = MIDI 61
 * note('C4').up(2).velocity(900)      // C6, velocity 900
 * note(60).duration(240).staccato()   // MIDI 60, 120 ticks (240 * 0.5)
 * note('F4').repeat(3)               // Emits F4 three times sequentially
 * ```
 */
export class NoteBuilder extends PitchStepBuilder<NoteBuilder> {
  private readonly _pitch: number
  private readonly _rawPitch: string | null

  constructor(params: Partial<NoteParams>) {
    super(params)
    this._pitch = params.pitch ?? 60
    this._rawPitch = params.rawPitch ?? null
  }

  /**
   * Override the MIDI pitch directly. Clears `rawPitch` since string
   * resolution no longer applies.
   *
   * @param pitch - MIDI note number (0-127)

   * @returns New NoteBuilder with the updated pitch
   */
  pitch(pitch: number): NoteBuilder {
    return new NoteBuilder({ ...this.shared, pitch, rawPitch: null })
  }

  /**
   * Resolve the final pitch and emit the note onto the bridge.
   *
   * **Pitch resolution order:**
   * 1. Raw string pitch + key context → `applyKeySignature` → `noteToMidi`
   * 2. Raw string pitch + `.natural()` → strip accidentals → `noteToMidi`
   * 3. Numeric pitch → used directly
   * 4. Final = resolved + accidentalOffset + (octaveShift × 12) + transposeSemitones
   *
   * Emits `repeatCount` notes at the resolved pitch, each advancing the tick.
   * Bridge flags (precise, muted, detune, timbre, pressure, aftertouch) are
   * applied before emission and reset after.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with note(s) emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let resolvedPitch = this._pitch

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
            resolvedPitch = midi
          }
        }
      } else if (this.shared.accidentalOverride === 'natural') {
        const adjusted = applyKeySignature(this._rawPitch, null, 'natural')
        if (adjusted !== null) {
          const midi = noteToMidi(adjusted)
          if (midi !== null) {
            resolvedPitch = midi
          }
        }
      }
    }

    const accidentalOffset = this._rawPitch !== null ? 0 : this.shared.accidental

    const finalPitch = resolvedPitch
      + accidentalOffset
      + (this.shared.octaveShift * 12)
      + this.shared.transposeSemitones

    let target = this.applyFlags(bridge)

    const scaledDuration = this.resolvedDuration()

    for (let i = 0; i < this.shared.repeatCount; ++i) {
      target = target.withNote(
        finalPitch,
        scaledDuration,
        this.shared.velocity ?? undefined,
      )
    }

    return this.resetFlags(target)
  }

  /** @internal Creates a new NoteBuilder preserving pitch state. */
  protected create(params: Partial<PitchStepParams>): NoteBuilder {
    return new NoteBuilder({ ...params, pitch: this._pitch, rawPitch: this._rawPitch })
  }
}
