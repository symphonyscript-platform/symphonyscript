import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { QuantizationBridge, QuantizationBridgeParams } from '../composition/QuantizationBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface QuantizationParams extends QuantizationBridgeParams {
  entries: PipeStep[][]
}

export class QuantizationBuilder extends ScopedEffectBuilder<QuantizationBuilder> {
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

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new QuantizationBridge(bridge, this.params)
  }

  protected cloneWithEntries(entries: PipeStep[][]): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<QuantizationParams>): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
