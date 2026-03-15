import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface DrumStepsParams {
  pattern: number[]
  pitch: number | null
  stepDuration: number | null
}

export class DrumStepsBuilder implements PipeStep {
  private readonly params: DrumStepsParams

  constructor(params: Partial<DrumStepsParams>) {
    this.params = {
      pattern: params.pattern ?? [],
      pitch: params.pitch ?? null,
      stepDuration: params.stepDuration ?? null,
    }
  }

  pitch(pitch: number): DrumStepsBuilder {
    return this.clone({ pitch })
  }

  pattern(pattern: number[]): DrumStepsBuilder {
    return this.clone({ pattern })
  }

  stepDuration(stepDuration: number): DrumStepsBuilder {
    return this.clone({ stepDuration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.pattern.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.pattern.length; ++i) {
      if (this.params.pattern[i]) {
        target = target.withNote(this.params.pitch, duration)
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  }

  private clone(overrides: Partial<DrumStepsParams>): DrumStepsBuilder {
    return new DrumStepsBuilder({ ...this.params, ...overrides })
  }
}
