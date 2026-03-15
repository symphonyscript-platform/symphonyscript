import { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

export interface NoteParams extends PitchStepParams {
  pitch: number
}

export class NoteBuilder extends PitchStepBuilder<NoteBuilder> {
  private readonly pitch: number

  constructor(params: Partial<NoteParams>) {
    super(params)
    this.pitch = params.pitch ?? 60
  }

  protected create(params: Partial<PitchStepParams>): NoteBuilder {
    return new NoteBuilder({ ...params, pitch: this.pitch })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const finalPitch = this.pitch
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
}
