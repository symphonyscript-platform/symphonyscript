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

  ghost(velocity: number = 300): DrumHitBuilder {
    return this.clone({ velocity })
  }

  accent(velocity: number = 1200): DrumHitBuilder {
    return this.clone({ velocity, precise: true })
  }

  flam(gap: number = 30): DrumHitBuilder {
    return this.clone({ flamOffset: gap })
  }

  flamRatio(ratio: number): DrumHitBuilder {
    return this.clone({ flamGraceRatio: ratio })
  }

  drag(count: number = 2): DrumHitBuilder {
    return this.clone({ dragCount: count })
  }

  dragSpacing(gap: number): DrumHitBuilder {
    return this.clone({ dragGap: gap })
  }

  dragRatio(ratio: number): DrumHitBuilder {
    return this.clone({ dragGraceRatio: ratio })
  }

  precise(): DrumHitBuilder {
    return this.clone({ precise: true })
  }

  muted(): DrumHitBuilder {
    return this.clone({ muted: true })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const duration = this.params.duration ?? bridge.defaultDuration
    const resolvedVelocity = this.params.velocity ?? bridge.velocity

    const wasPrecise = bridge.precise
    const wasMuted = bridge.muted

    let target = this.applyFlags(bridge, wasPrecise, wasMuted)

    target = this.emitDragGraceNotes(target, duration, resolvedVelocity)
    target = this.emitFlamGraceNote(target, duration, resolvedVelocity)

    // Main hit
    target = target.withNote(
      this.params.pitch,
      duration,
      this.params.velocity ?? undefined,
    )

    return this.resetFlags(target, wasPrecise, wasMuted)
  }

  /** Apply local flags only if this builder sets them and the bridge doesn't already have them. */
  private applyFlags(
    bridge: CompositionBridge,
    wasPrecise: boolean,
    wasMuted: boolean,
  ): CompositionBridge {
    let target = bridge

    if (this.params.precise && !wasPrecise) {
      target = target.withPrecise(true)
    }

    if (this.params.muted && !wasMuted) {
      target = target.withMuted(true)
    }

    return target
  }

  /** Restore flags only if this builder changed them. */
  private resetFlags(
    bridge: CompositionBridge,
    wasPrecise: boolean,
    wasMuted: boolean,
  ): CompositionBridge {
    let target = bridge

    if (this.params.precise && !wasPrecise) {
      target = target.withPrecise(false)
    }

    if (this.params.muted && !wasMuted) {
      target = target.withMuted(false)
    }

    return target
  }

  /** Emit drag grace notes spaced by dragGap ticks. */
  private emitDragGraceNotes(
    bridge: CompositionBridge,
    duration: number,
    resolvedVelocity: number,
  ): CompositionBridge {
    if (this.params.dragCount <= 0) return bridge

    const graceVelocity = Math.round(resolvedVelocity * this.params.dragGraceRatio)
    const startTick = bridge.tick
    let target = bridge

    for (let i = 0; i < this.params.dragCount; ++i) {
      target = target.withNote(this.params.pitch, duration, graceVelocity)
      target = target.withTick(startTick + this.params.dragGap * (i + 1))
    }

    return target
  }

  /** Emit flam grace note with gap before main hit. */
  private emitFlamGraceNote(
    bridge: CompositionBridge,
    duration: number,
    resolvedVelocity: number,
  ): CompositionBridge {
    if (this.params.flamOffset === null) return bridge

    const graceVelocity = Math.round(resolvedVelocity * this.params.flamGraceRatio)
    let target = bridge

    target = target.withNote(this.params.pitch, duration, graceVelocity)
    target = target.withTick(target.tick + this.params.flamOffset)

    return target
  }

  private clone(overrides: Partial<DrumHitParams>): DrumHitBuilder {
    return new DrumHitBuilder({ ...this.params, ...overrides })
  }
}
