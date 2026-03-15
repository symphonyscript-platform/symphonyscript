import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { HumanizationBridge, HumanizationBridgeParams } from '../composition/HumanizationBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface HumanizationParams {
  velocityJitter: number
  timingAmount: number
  rng: SeededRandom
  pipeSteps: PipeStep[]
}

export class HumanizationBuilder extends ScopedEffectBuilder<HumanizationBuilder> {
  private readonly params: HumanizationBridgeParams

  constructor(params: Partial<HumanizationParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      velocityJitter: params.velocityJitter ?? 0,
      timingAmount: params.timingAmount ?? 0,
      rng: params.rng ?? new SeededRandom(Date.now()),
    }
  }

  velocity(amount: number): HumanizationBuilder {
    return this.clone({ velocityJitter: amount })
  }

  timing(amount: number): HumanizationBuilder {
    return this.clone({ timingAmount: amount })
  }

  seed(s: number): HumanizationBuilder {
    return this.clone({ rng: new SeededRandom(s) })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new HumanizationBridge(bridge, this.params)
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): HumanizationBuilder {
    return new HumanizationBuilder({
      ...this.params,
      pipeSteps,
    })
  }

  private clone(overrides: Partial<HumanizationParams>): HumanizationBuilder {
    return new HumanizationBuilder({
      ...this.params,
      pipeSteps: this.pipeSteps,
      ...overrides,
    })
  }
}
