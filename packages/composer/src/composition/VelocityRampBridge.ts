import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/** Easing curve for velocity ramps: linear, 'exponential' (uses quadratic t², not true exponential), or smoothstep. */
export type EasingCurve = 'linear' | 'exponential' | 'smooth'

/**
 * Parameters for {@link VelocityRampBridge}.
 */
export interface VelocityRampParams {
  /** Tick at which the ramp begins. */
  startTick: number
  /** Tick at which the ramp ends. */
  endTick: number
  /** Velocity at ramp start (0–1000). */
  fromVelocity: number
  /** Velocity at ramp end (0–1000). */
  toVelocity: number
  /** Easing curve: `linear` (t), `exponential` (uses quadratic t², not true exponential), or `smooth` (3t² - 2t³). */
  curve: EasingCurve
}

/**
 * Bridge decorator that ramps velocity from `fromVelocity` to `toVelocity`
 * over the tick range [startTick, endTick], with configurable easing.
 *
 * Unlike {@link DynamicsBridge}, supports non-linear curves and always overrides
 * velocity when not explicitly passed (no `precise` bypass). When `range ≤ 0`
 * (startTick ≥ endTick), ramping is bypassed and notes pass through to the
 * inner bridge with default or explicitly passed velocity.
 *
 * Easing: `linear` = progress; `exponential` = progress² (slow start, fast end);
 * `smooth` = smoothstep 3t² - 2t³ (slow start and end).
 *
 * Immutable — each state transition returns a new `VelocityRampBridge` instance.
 *
 * @example
 * ```ts
 * // Linear crescendo (equivalent to DynamicsBridge)
 * new VelocityRampBridge(bridge, {
 *   startTick: 0, endTick: 960,
 *   fromVelocity: 64, toVelocity: 127,
 *   curve: 'linear',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Exponential ramp for faster swell toward the end
 * new VelocityRampBridge(bridge, {
 *   startTick: 0, endTick: 1920,
 *   fromVelocity: 40, toVelocity: 127,
 *   curve: 'exponential',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Smooth curve for natural crescendo/decrescendo
 * new VelocityRampBridge(bridge, {
 *   startTick: 480, endTick: 1440,
 *   fromVelocity: 80, toVelocity: 100,
 *   curve: 'smooth',
 * })
 * ```
 */
export class VelocityRampBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly ramp: VelocityRampParams,
  ) {
    super(bridge)
  }

  /**
   * Emit a note with velocity interpolated along the ramp.
   *
   * Progress is (tick - startTick) / (endTick - startTick) clamped to [0, 1],
   * then eased. Ramped velocity overrides bridge default when velocity is not
   * passed. When range ≤ 0, passes through to inner bridge unchanged.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in beats. Falls back to `defaultDuration`.
   * @param velocity - Optional velocity override; when provided, ramp is ignored for this note

   * @returns New bridge state with note emitted at ramped velocity
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    const currentTick = this.tick
    const range = this.ramp.endTick - this.ramp.startTick

    if (range <= 0) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    // Calculate progress (0..1) clamped
    let progress = (currentTick - this.ramp.startTick) / range
    if (progress < 0) progress = 0
    if (progress > 1) progress = 1

    // Apply easing curve
    const eased = this.applyEasing(progress)

    // Interpolate velocity
    const rampedVelocity = Math.round(
      this.ramp.fromVelocity + (this.ramp.toVelocity - this.ramp.fromVelocity) * eased,
    )

    // Use ramped velocity, overriding any provided velocity
    const finalVelocity = velocity ?? rampedVelocity

    return this.rewrap(this.bridge.withNote(pitch, duration, finalVelocity))
  }

  /** @internal Preserves ramp params when the decorator is re-wrapped. */
  protected rewrap(bridge: CompositionBridge): VelocityRampBridge {
    return new VelocityRampBridge(bridge, this.ramp)
  }

  /**
   * Apply easing curve to normalized progress (0..1).
   * linear: identity; exponential: t²; smooth: 3t² - 2t³ (smoothstep).
   */
  private applyEasing(progress: number): number {
    switch (this.ramp.curve) {
      case 'linear':
        return progress
      case 'exponential':
        return progress * progress
      case 'smooth':
        // Smoothstep: 3t² - 2t³
        return progress * progress * (3 - 2 * progress)
      default:
        return progress
    }
  }
}
