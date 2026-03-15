import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ChanceBridge } from '../composition/ChanceBridge'

export interface ChanceParams {
  probability: number
  seed: number | null
}

export class ChanceBuilder implements PipeStep {
  private readonly params: ChanceParams

  constructor(params: Partial<ChanceParams>) {
    this.params = {
      probability: params.probability ?? 1,
      seed: params.seed ?? null,
    }
  }

  private clone(overrides: Partial<ChanceParams>): ChanceBuilder {
    return new ChanceBuilder({ ...this.params, ...overrides })
  }

  seed(seed: number): ChanceBuilder {
    return this.clone({ seed })
  }

  probability(probability: number): ChanceBuilder {
    return this.clone({ probability })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new ChanceBridge(
      bridge,
      this.params.probability,
      this.params.seed ?? Date.now(),
    )
  }
}
