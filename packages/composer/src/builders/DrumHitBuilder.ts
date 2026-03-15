import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface DrumHitParams {
  pitch: number
  duration: number | null
  velocity: number | null
  precise: boolean
  muted: boolean
  flamOffset: number | null
  dragCount: number
}

export class DrumHitBuilder implements PipeStep {
  private readonly params: DrumHitParams

  constructor(params: Partial<DrumHitParams>) {
    this.params = {
      pitch: params.pitch ?? 36,
      duration: params.duration ?? null,
      velocity: params.velocity ?? null,
      precise: params.precise ?? false,
      muted: params.muted ?? false,
      flamOffset: params.flamOffset ?? null,
      dragCount: params.dragCount ?? 0,
    }
  }

  private clone(overrides: Partial<DrumHitParams>): DrumHitBuilder {
    return new DrumHitBuilder({ ...this.params, ...overrides })
  }

  velocity(velocity: number): DrumHitBuilder {
    return this.clone({ velocity })
  }

  duration(duration: number): DrumHitBuilder {
    return this.clone({ duration })
  }

  /** Ghost note — reduced velocity. */
  ghost(velocity: number = 300): DrumHitBuilder {
    return this.clone({ velocity })
  }

  /** Accented note — increased velocity. */
  accent(velocity: number = 1200): DrumHitBuilder {
    return this.clone({ velocity, precise: true })
  }

  /** Flam — two rapid hits, grace note before main. */
  flam(offset: number = 15): DrumHitBuilder {
    return this.clone({ flamOffset: offset })
  }

  /** Drag — three rapid hits before main. */
  drag(): DrumHitBuilder {
    return this.clone({ dragCount: 2 })
  }

  /** Skip humanization. */
  precise(): DrumHitBuilder {
    return this.clone({ precise: true })
  }

  /** Mute this hit. */
  muted(): DrumHitBuilder {
    return this.clone({ muted: true })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const duration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    if (this.params.precise) {
      target = target.withPrecise(true)
    }

    if (this.params.muted) {
      target = target.withMuted(true)
    }

    // Emit drag grace notes (rapid hits before the main)
    if (this.params.dragCount > 0) {
      const graceInterval = 10
      for (let i = 0; i < this.params.dragCount; ++i) {
        target = target.withNote(
          this.params.pitch,
          graceInterval,
          (this.params.velocity ?? bridge.velocity) - 200,
        )
      }
    }

    // Emit flam grace note
    if (this.params.flamOffset !== null) {
      target = target.withNote(
        this.params.pitch,
        this.params.flamOffset,
        (this.params.velocity ?? bridge.velocity) - 200,
      )
    }

    // Emit main hit
    target = target.withNote(
      this.params.pitch,
      duration,
      this.params.velocity ?? undefined,
    )

    // Reset flags
    if (this.params.precise) {
      target = target.withPrecise(false)
    }

    if (this.params.muted) {
      target = target.withMuted(false)
    }

    return target
  }
}
