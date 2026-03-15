import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { DynamicsBridge, DynamicsBridgeParams } from '../composition/DynamicsBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface DynamicsParams extends DynamicsBridgeParams {
  pipeSteps: PipeStep[]
}

export class DynamicsBuilder extends ScopedEffectBuilder<DynamicsBuilder> {
  private readonly params: DynamicsBridgeParams

  constructor(params: Partial<DynamicsParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      startVelocity: params.startVelocity ?? 600,
      endVelocity: params.endVelocity ?? 1000,
      startTick: params.startTick ?? 0,
      endTick: params.endTick ?? 1920,
    }
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new DynamicsBridge(bridge, this.params)
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<DynamicsParams>): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }

  from(startVelocity: number): DynamicsBuilder {
    return this.clone({ startVelocity })
  }

  to(endVelocity: number): DynamicsBuilder {
    return this.clone({ endVelocity })
  }

  start(tick: number): DynamicsBuilder {
    return this.clone({ startTick: tick })
  }

  end(tick: number): DynamicsBuilder {
    return this.clone({ endTick: tick })
  }
}
