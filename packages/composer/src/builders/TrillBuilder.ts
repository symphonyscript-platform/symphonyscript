import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

export interface TrillParams {
  pitch: NotePitch | null
  basePitch: NotePitch | null
  rate: number | null
  duration: number | null
}

export class TrillBuilder implements PipeStep {
  private readonly params: TrillParams

  constructor(params: Partial<TrillParams>) {
    this.params = {
      pitch: params.pitch ?? null,
      basePitch: params.basePitch ?? null,
      rate: params.rate ?? null,
      duration: params.duration ?? null,
    }
  }

  basePitch(basePitch: NotePitch): TrillBuilder {
    return this.clone({ basePitch })
  }

  pitch(pitch: NotePitch): TrillBuilder {
    return this.clone({ pitch })
  }

  rate(rate: number): TrillBuilder {
    return this.clone({ rate })
  }

  duration(duration: number): TrillBuilder {
    return this.clone({ duration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null || this.params.basePitch === null) return bridge

    const trillMidi = resolvePitch(this.params.pitch)
    const baseMidi = resolvePitch(this.params.basePitch)
    const rate = this.params.rate ?? bridge.defaultDuration
    const duration = this.params.duration ?? bridge.defaultDuration

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      const currentPitch = i % 2 === 0 ? baseMidi : trillMidi
      target = target.withNote(currentPitch, rate)
    }

    return target
  }

  private clone(overrides: Partial<TrillParams>): TrillBuilder {
    return new TrillBuilder({ ...this.params, ...overrides })
  }
}
