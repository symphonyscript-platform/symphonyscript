import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { SwingBridge, SwingBridgeParams } from '../composition/SwingBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface SwingParams extends SwingBridgeParams {
  pipeSteps: PipeStep[]
}

export class SwingBuilder extends ScopedEffectBuilder<SwingBuilder> {
  private readonly params: SwingBridgeParams

  constructor(params: Partial<SwingParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      amount: params.amount ?? 0.5,
      grid: params.grid ?? 480,
    }
  }

  amount(amount: number): SwingBuilder {
    return this.clone({ amount })
  }

  grid(grid: number): SwingBuilder {
    return this.clone({ grid })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new SwingBridge(bridge, this.params)
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): SwingBuilder {
    return new SwingBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<SwingParams>): SwingBuilder {
    return new SwingBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }
}
