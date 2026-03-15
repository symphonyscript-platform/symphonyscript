import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { applyKeySignature, type KeyContext } from '@symphonyscript/theory'
import { noteToMidi } from '@symphonyscript/theory'

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

    // If we have a raw pitch string and the bridge has a key context, apply key accidentals
    if (this._rawPitch !== null && bridge.keyRoot >= 0) {
      const keyContext: KeyContext = {
        root: bridge.keyRoot as any,
        mode: bridge.keyMode as any,
      }
      const adjusted = applyKeySignature(this._rawPitch, keyContext)
      if (adjusted !== null) {
        const midi = noteToMidi(adjusted)
        if (midi !== null) {
          resolvedPitch = midi
        }
      }
    }

    const finalPitch = resolvedPitch
      + this.shared.accidental
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
