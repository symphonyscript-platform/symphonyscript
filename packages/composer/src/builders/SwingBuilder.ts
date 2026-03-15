import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { SwingBridge, SwingBridgeParams } from '../composition/SwingBridge'
import { ScopedEffectBuilder, ScopeEntry } from './ScopedEffectBuilder'

export interface SwingParams extends SwingBridgeParams {
  entries: ScopeEntry[]
}

export class SwingBuilder extends ScopedEffectBuilder<SwingBuilder> {
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

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new SwingBridge(bridge, this.params)
  }

  protected cloneWithEntries(entries: ScopeEntry[]): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<SwingParams>): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
