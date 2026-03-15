import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { HumanizationBridge, HumanizationBridgeParams } from '../composition/HumanizationBridge'

export class HumanizationBuilder implements PipeStep {
  private readonly params: HumanizationBridgeParams

  constructor(params: Partial<HumanizationBridgeParams>) {
    this.params = {
      velocityJitter: params.velocityJitter ?? 0,
      timingAmount: params.timingAmount ?? 0,
      rng: params.rng ?? new SeededRandom(Date.now()),
    }
  }

  velocity(amount: number): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, velocityJitter: amount })
  }

  timing(amount: number): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, timingAmount: amount })
  }

  seed(s: number): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, rng: new SeededRandom(s) })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new HumanizationBridge(bridge, this.params)
  }
}
