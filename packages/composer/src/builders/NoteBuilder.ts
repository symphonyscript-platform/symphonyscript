import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { applyKeySignature, noteToMidi } from '@symphonyscript/theory'
import type { KeyContext } from '@symphonyscript/theory'

export interface NoteParams extends PitchStepParams {
  pitch: number
  rawPitch: string | null
}

export class NoteBuilder extends PitchStepBuilder<NoteBuilder> {
  private readonly _pitch: number
  private readonly _rawPitch: string | null

  constructor(params: Partial<NoteParams>) {
    super(params)
    this._pitch = params.pitch ?? 60
    this._rawPitch = params.rawPitch ?? null
  }

  pitch(pitch: number): NoteBuilder {
    return new NoteBuilder({ ...this.shared, pitch, rawPitch: null })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    let resolvedPitch = this._pitch

    if (this._rawPitch !== null) {
      if (bridge.keyRoot !== null) {
        // Key context active — use applyKeySignature with override
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
        // No key context, .natural() → strip any accidental from the string
        const adjusted = applyKeySignature(this._rawPitch, null, 'natural')
        if (adjusted !== null) {
          const midi = noteToMidi(adjusted)
          if (midi !== null) {
            resolvedPitch = midi
          }
        }
      }
      // No key, no override → use the pre-resolved pitch as-is
    }

    // For non-string pitches or when raw pitch was not used,
    // accidental is a numeric semitone offset (legacy behavior for degree/chord compat)
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

  protected create(params: Partial<PitchStepParams>): NoteBuilder {
    return new NoteBuilder({ ...params, pitch: this._pitch, rawPitch: this._rawPitch })
  }
}
