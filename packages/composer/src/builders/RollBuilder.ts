import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface RollParams {
  pitch: number | null
  duration: number | null
  rate: number | null
}

export class RollBuilder implements PipeStep {
  private readonly params: RollParams

  constructor(params: Partial<RollParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      duration: params.duration ?? null,
      rate: params.rate ?? null,
    }
  }

  private clone(overrides: Partial<RollParams>): RollBuilder {
    return new RollBuilder({ ...this.params, ...overrides })
  }

  duration(duration: number): RollBuilder {
    return this.clone({ duration })
  }

  rate(rate: number): RollBuilder {
    return this.clone({ rate })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const duration = this.params.duration ?? bridge.defaultDuration
    const hitDuration = this.params.rate ?? Math.round(bridge.defaultDuration / 4)
    const hitCount = Math.floor(duration / hitDuration)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(this.params.pitch, hitDuration)
    }

    return target
  }
}
