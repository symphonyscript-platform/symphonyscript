import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

export interface GlissandoParams {
  from: NotePitch | null
  to: NotePitch | null
  duration: number | null
}

export class GlissandoBuilder implements PipeStep {
  private readonly params: GlissandoParams

  constructor(params: Partial<GlissandoParams>) {
    this.params = {
      from: params.from ?? null,
      to: params.to ?? null,
      duration: params.duration ?? null,
    }
  }

  private clone(overrides: Partial<GlissandoParams>): GlissandoBuilder {
    return new GlissandoBuilder({ ...this.params, ...overrides })
  }

  to(to: NotePitch): GlissandoBuilder {
    return this.clone({ to })
  }

  from(from: NotePitch): GlissandoBuilder {
    return this.clone({ from })
  }

  duration(duration: number): GlissandoBuilder {
    return this.clone({ duration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.from === null || this.params.to === null) return bridge

    const fromMidi = resolvePitch(this.params.from)
    const toMidi = resolvePitch(this.params.to)
    const duration = this.params.duration ?? bridge.defaultDuration

    const direction = toMidi > fromMidi ? 1 : -1
    const semitoneCount = Math.abs(toMidi - fromMidi)

    if (semitoneCount === 0) {
      return bridge.withNote(fromMidi, duration)
    }

    const stepDuration = Math.round(duration / semitoneCount)
    let target = bridge

    for (let i = 0; i <= semitoneCount; ++i) {
      const currentPitch = fromMidi + (i * direction)
      target = target.withNote(currentPitch, stepDuration)
    }

    return target
  }
}
