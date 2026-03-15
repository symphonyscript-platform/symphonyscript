import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface LoopParams {
  count: number
  pipeSteps: PipeStep[]
}

export class LoopBuilder implements PipeStep {
  private readonly params: LoopParams

  constructor(params: Partial<LoopParams>) {
    this.params = {
      count: params.count ?? 1,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  count(count: number): LoopBuilder {
    return this.clone({ count })
  }

  steps(...pipeSteps: PipeStep[]): LoopBuilder {
    return this.clone({ pipeSteps })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) return bridge

    let target = bridge

    for (let i = 0; i < this.params.count; ++i) {
      for (let j = 0; j < this.params.pipeSteps.length; ++j) {
        target = this.params.pipeSteps[j].apply(target)
      }
    }

    return target
  }

  private clone(overrides: Partial<LoopParams>): LoopBuilder {
    return new LoopBuilder({ ...this.params, ...overrides })
  }
}
