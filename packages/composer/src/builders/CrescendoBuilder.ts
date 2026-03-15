import { ScopedEffectBuilder } from './ScopedEffectBuilder'
import { EasingCurve, VelocityRampBridge } from '../composition/VelocityRampBridge'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface CrescendoParams {
  duration: number
  from: number
  to: number
  curve: EasingCurve
  entries: PipeStep[][]
}

export class CrescendoBuilder extends ScopedEffectBuilder<CrescendoBuilder> {
  private readonly params: Omit<CrescendoParams, 'entries'>

  constructor(params: Partial<CrescendoParams>) {
    super(params.entries ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 400,
      to: params.to ?? 1200,
      curve: params.curve ?? 'linear',
    }
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

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }

  protected cloneWithEntries(entries: PipeStep[][]): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<CrescendoParams>): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}