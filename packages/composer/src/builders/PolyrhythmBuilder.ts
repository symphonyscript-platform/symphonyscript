import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface PolyrhythmParams {
  noteCount: number
  overBeats: number
  pipeSteps: PipeStep[]
}

export class PolyrhythmBuilder implements PipeStep {
  private readonly params: PolyrhythmParams

  constructor(params: Partial<PolyrhythmParams>) {
    this.params = {
      noteCount: params.noteCount ?? 3,
      overBeats: params.overBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  overBeats(overBeats: number): PolyrhythmBuilder {
    return this.clone({ overBeats })
  }

  noteCount(noteCount: number): PolyrhythmBuilder {
    return this.clone({ noteCount })
  }

  steps(...pipeSteps: PipeStep[]): PolyrhythmBuilder {
    return this.clone({ pipeSteps })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) return bridge

    const totalDuration = this.params.overBeats * bridge.defaultDuration
    const noteDuration = Math.round(totalDuration / this.params.noteCount)
    let target = bridge.withDefaultDuration(noteDuration)

    for (let i = 0; i < this.params.pipeSteps.length; ++i) {
      target = this.params.pipeSteps[i].apply(target)
    }

    return target
  }

  private clone(overrides: Partial<PolyrhythmParams>): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, ...overrides })
  }
}
