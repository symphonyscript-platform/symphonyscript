import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

export interface DegreeParams extends PitchStepParams {
  degree: number
}

export class DegreeBuilder extends PitchStepBuilder<DegreeBuilder> {
  private readonly _degree: number

  constructor(params: Partial<DegreeParams>) {
    super(params)
    this._degree = params.degree ?? 1
  }

  degree(degree: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.shared, degree })
  }

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

  protected create(params: Partial<PitchStepParams>): DegreeBuilder {
    return new DegreeBuilder({ ...params, degree: this._degree })
  }
}
