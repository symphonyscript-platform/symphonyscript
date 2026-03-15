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

  velocity(velocity: number): DrumHitBuilder {
    return this.clone({ velocity })
  }

  pitch(pitch: number): DrumHitBuilder {
    return this.clone({ pitch })
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
    const resolvedVelocity = this.params.velocity ?? bridge.velocity
    const graceVelocity = Math.max(0, resolvedVelocity - 200)

    // Snapshot original flags to restore after this step
    const wasPrecise = bridge.precise
    const wasMuted = bridge.muted

    let target = bridge

    // Apply local flags for this hit only
    if (this.params.precise && !wasPrecise) {
      target = target.withPrecise(true)
    }
    if (this.params.muted && !wasMuted) {
      target = target.withMuted(true)
    }

    // Emit drag grace notes (rapid hits before the main)
    if (this.params.dragCount > 0) {
      const graceInterval = 10
      for (let i = 0; i < this.params.dragCount; ++i) {
        target = target.withNote(this.params.pitch, graceInterval, graceVelocity)
      }
    }

    // Emit flam grace note
    if (this.params.flamOffset !== null) {
      target = target.withNote(this.params.pitch, this.params.flamOffset, graceVelocity)
    }

    // Emit main hit
    target = target.withNote(
      this.params.pitch,
      duration,
      this.params.velocity ?? undefined,
    )

    // Restore original flags
    if (this.params.precise && !wasPrecise) {
      target = target.withPrecise(false)
    }
    if (this.params.muted && !wasMuted) {
      target = target.withMuted(false)
    }

    return target
  }

  private clone(overrides: Partial<DrumHitParams>): DrumHitBuilder {
    return new DrumHitBuilder({ ...this.params, ...overrides })
  }
}
