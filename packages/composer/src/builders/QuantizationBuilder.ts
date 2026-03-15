import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { QuantizationBridge, QuantizationBridgeParams } from '../composition/QuantizationBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface QuantizationParams extends QuantizationBridgeParams {
  pipeSteps: PipeStep[]
}

export class QuantizationBuilder extends ScopedEffectBuilder<QuantizationBuilder> {
  private readonly params: QuantizationBridgeParams

  constructor(params: Partial<QuantizationParams>) {
    super(params.pipeSteps ?? [])
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

  protected cloneWithSteps(pipeSteps: PipeStep[]): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<QuantizationParams>): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }
}
