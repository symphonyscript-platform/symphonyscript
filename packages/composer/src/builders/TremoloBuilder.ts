import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

export interface TremoloParams {
  pitch: NotePitch | null
  rate: number | null
  duration: number | null
}

export class TremoloBuilder implements PipeStep {
  private readonly params: TremoloParams

  constructor(params: Partial<TremoloParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      rate: params.rate ?? null,
      duration: params.duration ?? null,
    }
  }

  private clone(overrides: Partial<TremoloParams>): TremoloBuilder {
    return new TremoloBuilder({ ...this.params, ...overrides })
  }

  rate(rate: number): TremoloBuilder {
    return this.clone({ rate })
  }

  pitch(pitch: NotePitch): TremoloBuilder {
    return this.clone({ pitch })
  }

  duration(duration: number): TremoloBuilder {
    return this.clone({ duration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const midi = resolvePitch(this.params.pitch)
    const rate = this.params.rate ?? bridge.defaultDuration
    const duration = this.params.duration ?? bridge.defaultDuration

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(midi, rate)
    }

    return target
  }
}
