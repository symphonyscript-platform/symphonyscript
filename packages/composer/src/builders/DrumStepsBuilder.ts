import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { applyBinaryPattern } from '../utils/binary-pattern'

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

    return applyBinaryPattern(this.params.pattern, [this.params.pitch], duration, bridge)
  }

  private clone(overrides: Partial<DrumStepsParams>): DrumStepsBuilder {
    return new DrumStepsBuilder({ ...this.params, ...overrides })
  }
}
