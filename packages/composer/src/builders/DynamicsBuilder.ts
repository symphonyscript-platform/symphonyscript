import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { DynamicsBridge, DynamicsBridgeParams } from '../composition/DynamicsBridge'

export class DynamicsBuilder implements PipeStep {
  private readonly params: DynamicsBridgeParams

  constructor(params: Partial<DynamicsBridgeParams>) {
    this.params = {
      startVelocity: params.startVelocity ?? 600,
      endVelocity: params.endVelocity ?? 1000,
      startTick: params.startTick ?? 0,
      endTick: params.endTick ?? 1920,
    }
  }

  from(startVelocity: number): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, startVelocity })
  }

  to(endVelocity: number): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, endVelocity })
  }

  start(tick: number): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, startTick: tick })
  }

  end(tick: number): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, endTick: tick })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new DynamicsBridge(bridge, this.params)
  }
}
