import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { VelocityRampBridge } from '../composition/VelocityRampBridge'
import type { EasingCurve } from '../composition/VelocityRampBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface CrescendoParams {
  duration: number
  from: number
  to: number
  curve: EasingCurve
  pipeSteps: PipeStep[]
}

export class CrescendoBuilder extends ScopedEffectBuilder<CrescendoBuilder> {
  private readonly params: Omit<CrescendoParams, 'pipeSteps'>

  constructor(params: Partial<CrescendoParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 400,
      to: params.to ?? 1200,
      curve: params.curve ?? 'linear',
    }
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<CrescendoParams>): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }

  duration(duration: number): CrescendoBuilder {
    return this.clone({ duration })
  }

  from(from: number): CrescendoBuilder {
    return this.clone({ from })
  }

  to(to: number): CrescendoBuilder {
    return this.clone({ to })
  }

  curve(curve: EasingCurve): CrescendoBuilder {
    return this.clone({ curve })
  }
}

export class DecrescendoBuilder extends ScopedEffectBuilder<DecrescendoBuilder> {
  private readonly params: Omit<CrescendoParams, 'pipeSteps'>

  constructor(params: Partial<CrescendoParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 1200,
      to: params.to ?? 400,
      curve: params.curve ?? 'linear',
    }
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<CrescendoParams>): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }

  duration(duration: number): DecrescendoBuilder {
    return this.clone({ duration })
  }

  from(from: number): DecrescendoBuilder {
    return this.clone({ from })
  }

  to(to: number): DecrescendoBuilder {
    return this.clone({ to })
  }

  curve(curve: EasingCurve): DecrescendoBuilder {
    return this.clone({ curve })
  }
}
