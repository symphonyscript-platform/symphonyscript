import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { VelocityRampBridge } from '../composition/VelocityRampBridge'
import type { EasingCurve } from '../composition/VelocityRampBridge'

export interface CrescendoParams {
  duration: number
  from: number
  to: number
  curve: EasingCurve
}

export class CrescendoBuilder implements PipeStep {
  private readonly params: CrescendoParams

  constructor(params: Partial<CrescendoParams>) {
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 400,
      to: params.to ?? 1200,
      curve: params.curve ?? 'linear',
    }
  }

  private clone(overrides: Partial<CrescendoParams>): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, ...overrides })
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

  apply(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }
}

export class DecrescendoBuilder implements PipeStep {
  private readonly params: CrescendoParams

  constructor(params: Partial<CrescendoParams>) {
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 1200,
      to: params.to ?? 400,
      curve: params.curve ?? 'linear',
    }
  }

  private clone(overrides: Partial<CrescendoParams>): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, ...overrides })
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

  apply(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }
}
