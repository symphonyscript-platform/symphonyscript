import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface DrumPatternParams {
  notation: string
  pitch: number | null
  stepDuration: number | null
}

export class DrumPatternBuilder implements PipeStep {
  private readonly params: DrumPatternParams

  constructor(params: Partial<DrumPatternParams>) {
    this.params = {
      notation: params.notation ?? '',
      pitch: params.pitch ?? null,
      stepDuration: params.stepDuration ?? null,
    }
  }

  private clone(overrides: Partial<DrumPatternParams>): DrumPatternBuilder {
    return new DrumPatternBuilder({ ...this.params, ...overrides })
  }

  pitch(pitch: number): DrumPatternBuilder {
    return this.clone({ pitch })
  }

  notation(notation: string): DrumPatternBuilder {
    return this.clone({ notation })
  }

  stepDuration(stepDuration: number): DrumPatternBuilder {
    return this.clone({ stepDuration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.notation.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.notation.length; ++i) {
      const character = this.params.notation[i]
      if (character === 'x' || character === 'X') {
        target = target.withNote(this.params.pitch, duration)
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  }
}
