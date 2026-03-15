import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface DrumHitParams {
  pitch: number
  duration: number | null
  velocity: number | null
  precise: boolean
  muted: boolean
  flamOffset: number | null
  flamGraceRatio: number
  dragCount: number
  dragGap: number
  dragGraceRatio: number
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
      flamGraceRatio: params.flamGraceRatio ?? 0.6,
      dragCount: params.dragCount ?? 0,
      dragGap: params.dragGap ?? 30,
      dragGraceRatio: params.dragGraceRatio ?? 0.5,
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

  /** Flam — grace note before main hit. */
  flam(gap: number = 30): DrumHitBuilder {
    return this.clone({ flamOffset: gap })
  }

  /** Set the velocity ratio for flam grace note (0–1). */
  flamRatio(ratio: number): DrumHitBuilder {
    return this.clone({ flamGraceRatio: ratio })
  }

  /** Drag — multiple grace notes before main hit. */
  drag(count: number = 2): DrumHitBuilder {
    return this.clone({ dragCount: count })
  }

  /** Set the tick gap between drag grace notes. */
  dragSpacing(gap: number): DrumHitBuilder {
    return this.clone({ dragGap: gap })
  }

  /** Set the velocity ratio for drag grace notes (0–1). */
  dragRatio(ratio: number): DrumHitBuilder {
    return this.clone({ dragGraceRatio: ratio })
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

    // Emit drag grace notes — spaced by dragGap ticks
    if (this.params.dragCount > 0) {
      const graceVelocity = Math.round(resolvedVelocity * this.params.dragGraceRatio)

      for (let i = 0; i < this.params.dragCount; ++i) {
        target = target.withNote(this.params.pitch, duration, graceVelocity)
        target = target.withTick(bridge.tick + this.params.dragGap * (i + 1))
      }
    }

    // Emit flam grace note — then advance by gap
    if (this.params.flamOffset !== null) {
      const graceVelocity = Math.round(resolvedVelocity * this.params.flamGraceRatio)
      target = target.withNote(this.params.pitch, duration, graceVelocity)
      target = target.withTick(target.tick + this.params.flamOffset)
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
