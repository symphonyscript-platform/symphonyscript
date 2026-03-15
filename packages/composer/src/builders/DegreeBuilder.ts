import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

export interface DegreeParams extends PitchStepParams {
  degree: number
}

export class DegreeBuilder extends PitchStepBuilder<DegreeBuilder> {
  private readonly degree: number

  constructor(params: Partial<DegreeParams>) {
    super(params)
    this.degree = params.degree ?? 1
  }

  protected create(params: Partial<PitchStepParams>): DegreeBuilder {
    return new DegreeBuilder({ ...params, degree: this.degree })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const pitch = degreeToPitch(
      this.degree,
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
}
