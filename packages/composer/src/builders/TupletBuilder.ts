import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface TupletParams {
  count: number
  inBeats: number
  pipeSteps: PipeStep[]
}

export class TupletBuilder implements PipeStep {
  private readonly params: TupletParams

  constructor(params: Partial<TupletParams>) {
    this.params = {
      count: params.count ?? 3,
      inBeats: params.inBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  private clone(overrides: Partial<TupletParams>): TupletBuilder {
    return new TupletBuilder({ ...this.params, ...overrides })
  }

  inBeats(inBeats: number): TupletBuilder {
    return this.clone({ inBeats })
  }

  count(count: number): TupletBuilder {
    return this.clone({ count })
  }

  steps(...pipeSteps: PipeStep[]): TupletBuilder {
    return this.clone({ pipeSteps })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) return bridge

    const totalDuration = this.params.inBeats * bridge.defaultDuration
    const tupletDuration = Math.round(totalDuration / this.params.count)
    let target = bridge.withDefaultDuration(tupletDuration)

    for (let i = 0; i < this.params.pipeSteps.length; ++i) {
      target = this.params.pipeSteps[i].apply(target)
    }

    return target
  }
}
