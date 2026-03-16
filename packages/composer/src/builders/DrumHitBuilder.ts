import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Parameters for {@link DrumHitBuilder}.
 */
export interface DrumHitParams {
  /** MIDI pitch for the drum hit. Defaults to 36 (bass drum). */
  pitch: number
  /** Note duration in ticks. `null` uses bridge default. */
  duration: number | null
  /** Velocity override. `null` uses bridge default. */
  velocity: number | null
  /** When true, hit uses precise timing. Defaults to false. */
  precise: boolean
  /** When true, hit is muted. Defaults to false. */
  muted: boolean
  /** Flam grace note offset in ticks before main hit. `null` = no flam. Defaults to null. */
  flamOffset: number | null
  /** Velocity ratio for flam grace note (0–1). Defaults to 0.6. */
  flamGraceRatio: number
  /** Number of drag grace notes before main hit. 0 = no drag. Defaults to 0. */
  dragCount: number
  /** Spacing in ticks between drag grace notes. Defaults to 30. */
  dragGap: number
  /** Velocity ratio for drag grace notes (0–1). Defaults to 0.5. */
  dragGraceRatio: number
}

/**
 * Immutable builder for a single drum hit with optional flam, drag, and articulation.
 *
 * Emits one main note, with optional grace notes (flam = one before, drag = multiple before).
 * Supports ghost notes (low velocity), accents (high velocity + precise), and muted hits.
 * Often used via notation helpers: {@link kick}, {@link snare}, {@link hit}, {@link flam}, {@link drag}.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * kick()                                      // Bass drum, bridge default duration
 * snare(240).ghost(300)                       // Ghost snare
 * hit(36).accent().duration(120)              // Accented kick
 * flam(38).flamRatio(0.5)                     // Flam with custom grace ratio
 * hit(36).drag(3).dragSpacing(20)             // 3 grace notes before main hit
 * kick().apply(bridge)
 * ```
 */
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

  /**
   * Set the velocity for the main hit.
   *
   * @param velocity - MIDI velocity (0–16383)
   * @returns New builder with the updated velocity
   */
  velocity(velocity: number): DrumHitBuilder {
    return this.clone({ velocity })
  }

  /**
   * Set the MIDI pitch for the drum hit.
   *
   * @param pitch - MIDI note number (0-127), e.g. GM drum map values
   * @returns New builder with the updated pitch
   */
  pitch(pitch: number): DrumHitBuilder {
    return this.clone({ pitch })
  }

  /**
   * Set the note duration in ticks.
   *
   * @param duration - Ticks per note
   * @returns New builder with the updated duration
   */
  duration(duration: number): DrumHitBuilder {
    return this.clone({ duration })
  }

  /**
   * Configure a ghost note (low velocity, typically for soft hits).
   *
   * @param velocity - MIDI velocity. Defaults to 300.
   * @returns New builder with ghost articulation
   */
  ghost(velocity: number = 300): DrumHitBuilder {
    return this.clone({ velocity })
  }

  /**
   * Configure an accented hit (high velocity + precise timing).
   *
   * @param velocity - MIDI velocity. Defaults to 1200.
   * @returns New builder with accent articulation
   */
  accent(velocity: number = 1200): DrumHitBuilder {
    return this.clone({ velocity, precise: true })
  }

  /**
   * Add a flam: one grace note immediately before the main hit.
   *
   * @param gap - Ticks between grace note and main hit. Defaults to 30.
   * @returns New builder with flam enabled
   */
  flam(gap: number = 30): DrumHitBuilder {
    return this.clone({ flamOffset: gap })
  }

  /**
   * Set the velocity ratio for the flam grace note.
   *
   * @param ratio - Ratio (0–1) applied to main velocity
   * @returns New builder with the updated flam ratio
   */
  flamRatio(ratio: number): DrumHitBuilder {
    return this.clone({ flamGraceRatio: ratio })
  }

  /**
   * Add drag: multiple grace notes before the main hit.
   *
   * @param count - Number of grace notes. Defaults to 2.
   * @returns New builder with drag enabled
   */
  drag(count: number = 2): DrumHitBuilder {
    return this.clone({ dragCount: count })
  }

  /**
   * Set the spacing in ticks between drag grace notes.
   *
   * @param gap - Ticks between grace notes
   * @returns New builder with the updated drag spacing
   */
  dragSpacing(gap: number): DrumHitBuilder {
    return this.clone({ dragGap: gap })
  }

  /**
   * Set the velocity ratio for drag grace notes.
   *
   * @param ratio - Ratio (0–1) applied to main velocity
   * @returns New builder with the updated drag ratio
   */
  dragRatio(ratio: number): DrumHitBuilder {
    return this.clone({ dragGraceRatio: ratio })
  }

  /**
   * Enable precise timing for the hit.
   *
   * @returns New builder with precise flag set
   */
  precise(): DrumHitBuilder {
    return this.clone({ precise: true })
  }

  /**
   * Enable muted articulation for the hit.
   *
   * @returns New builder with muted flag set
   */
  muted(): DrumHitBuilder {
    return this.clone({ muted: true })
  }

  /**
   * Emit the drum hit onto the bridge.
   *
   * Applies local flags (precise, muted), emits drag grace notes (if dragCount > 0),
   * flam grace note (if flamOffset set), then the main hit. Resets flags afterwards.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with the drum hit emitted
   */
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

  /** @internal Apply local flags only if this builder sets them and the bridge doesn't already have them. */
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

  /** @internal Restore flags only if this builder changed them. */
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

  /** @internal Emit drag grace notes spaced by dragGap ticks. */
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

  /** @internal Emit flam grace note with gap before main hit. */
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

  /** @internal Creates a new DrumHitBuilder with merged params. */
  private clone(overrides: Partial<DrumHitParams>): DrumHitBuilder {
    return new DrumHitBuilder({ ...this.params, ...overrides })
  }
}
