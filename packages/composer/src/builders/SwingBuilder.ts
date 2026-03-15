import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { SwingBridge, SwingBridgeParams } from '../composition/SwingBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'

export interface SwingParams extends SwingBridgeParams {
  entries: PipeStep[][]
}

export class SwingBuilder extends ScopedStepBuilder<SwingBuilder> {
  private readonly params: Omit<SwingParams, 'entries'>

  constructor(params: Partial<SwingParams>) {
    super(params.entries ?? [])
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

  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new SwingBridge(bridge, this.params)
  }

  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  protected cloneWithEntries(entries: PipeStep[][]): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<SwingParams>): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
