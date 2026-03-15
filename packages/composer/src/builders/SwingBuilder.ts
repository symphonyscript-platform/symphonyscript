import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { SwingBridge, SwingBridgeParams } from '../composition/SwingBridge'

export class SwingBuilder implements PipeStep {
  private readonly params: SwingBridgeParams

  constructor(params: Partial<SwingBridgeParams>) {
    this.params = {
      amount: params.amount ?? 0.5,
      grid: params.grid ?? 480,
    }
  }

  amount(amount: number): SwingBuilder {
    return new SwingBuilder({ ...this.params, amount })
  }

  grid(grid: number): SwingBuilder {
    return new SwingBuilder({ ...this.params, grid })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new SwingBridge(bridge, this.params)
  }
}
