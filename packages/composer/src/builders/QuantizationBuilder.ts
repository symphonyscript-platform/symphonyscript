import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { QuantizationBridge, QuantizationBridgeParams } from '../composition/QuantizationBridge'

export class QuantizationBuilder implements PipeStep {
  private readonly params: QuantizationBridgeParams

  constructor(params: Partial<QuantizationBridgeParams>) {
    this.params = {
      grid: params.grid ?? 480,
      strength: params.strength ?? 1.0,
    }
  }

  grid(grid: number): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, grid })
  }

  strength(strength: number): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, strength })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new QuantizationBridge(bridge, this.params)
  }
}
