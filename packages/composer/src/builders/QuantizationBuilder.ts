import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { QuantizationBridge, QuantizationBridgeParams } from '../composition/QuantizationBridge'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import { ScopedStepBuilder } from './ScopedStepBuilder'

export interface QuantizationParams extends QuantizationBridgeParams {
  entries: PipeStep[][]
}

export class QuantizationBuilder extends ScopedStepBuilder<QuantizationBuilder> {
  private readonly params: Omit<QuantizationParams, 'entries'>

  constructor(params: Partial<QuantizationParams>) {
    super(params.entries ?? [])
    this.params = {
      grid: params.grid ?? 480,
      strength: params.strength ?? 1.0,
    }
  }

  grid(grid: number): QuantizationBuilder {
    return this.clone({ grid })
  }

  strength(strength: number): QuantizationBuilder {
    return this.clone({ strength })
  }

  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new QuantizationBridge(bridge, this.params)
  }

  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  protected cloneWithEntries(entries: PipeStep[][]): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<QuantizationParams>): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
