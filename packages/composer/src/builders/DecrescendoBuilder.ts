import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { EasingCurve } from '../composition/VelocityRampBridge'
import { VelocityRampBridge } from '../composition/VelocityRampBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface DecrescendoParams {
  duration: number
  from: number
  to: number
  curve: EasingCurve
  entries: PipeStep[][]
}

export class DecrescendoBuilder extends ScopedEffectBuilder<DecrescendoBuilder> {
  private readonly params: Omit<DecrescendoParams, 'entries'>

  constructor(params: Partial<DecrescendoParams>) {
    super(params.entries ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 1200,
      to: params.to ?? 400,
      curve: params.curve ?? 'linear',
    }
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

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }

  protected cloneWithEntries(entries: PipeStep[][]): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<DecrescendoParams>): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
