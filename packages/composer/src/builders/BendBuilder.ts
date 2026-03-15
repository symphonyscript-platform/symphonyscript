import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface BendParams {
  value: number
  pipeSteps: PipeStep[]
}

export class BendBuilder implements PipeStep {
  private readonly params: BendParams

  constructor(params: Partial<BendParams>) {
    this.params = {
      value: params.value ?? 0,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  private clone(overrides: Partial<BendParams>): BendBuilder {
    return new BendBuilder({ ...this.params, ...overrides })
  }

  value(value: number): BendBuilder {
    return this.clone({ value })
  }

  steps(...pipeSteps: PipeStep[]): BendBuilder {
    return this.clone({ pipeSteps })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) {
      // Setter mode: just set the bend, no auto-reset
      return bridge.withBend(this.params.value)
    }

    // Scoped mode: set bend → apply steps → reset bend
    let target = bridge.withBend(this.params.value)

    for (let i = 0; i < this.params.pipeSteps.length; ++i) {
      target = this.params.pipeSteps[i].apply(target)
    }

    return target.withBend(0)
  }
}
