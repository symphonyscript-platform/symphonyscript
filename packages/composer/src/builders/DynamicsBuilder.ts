import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { DynamicsBridge, DynamicsBridgeParams } from '../composition/DynamicsBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface DynamicsParams extends DynamicsBridgeParams {
  entries: PipeStep[][]
}

export class DynamicsBuilder extends ScopedEffectBuilder<DynamicsBuilder> {
  private readonly params: Omit<DynamicsParams, 'entries'>

  constructor(params: Partial<DynamicsParams>) {
    super(params.entries ?? [])
    this.params = {
      startVelocity: params.startVelocity ?? 600,
      endVelocity: params.endVelocity ?? 1000,
      startTick: params.startTick ?? 0,
      endTick: params.endTick ?? 480,
    }
  }

  startVelocity(velocity: number): DynamicsBuilder {
    return this.clone({ startVelocity: velocity })
  }

  endVelocity(velocity: number): DynamicsBuilder {
    return this.clone({ endVelocity: velocity })
  }

  start(tick: number): DynamicsBuilder {
    return this.clone({ startTick: tick })
  }

  end(tick: number): DynamicsBuilder {
    return this.clone({ endTick: tick })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new DynamicsBridge(bridge, this.params)
  }

  protected cloneWithEntries(entries: PipeStep[][]): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<DynamicsParams>): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
