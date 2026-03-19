import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Parameters for {@link DynamicsBridge}.
 */
export interface DynamicsBridgeParams {
  /** Velocity at the start of the ramp range (0–1000). */
  startVelocity: number
  /** Velocity at the end of the ramp range (0–1000). */
  endVelocity: number
  /** Tick at which the ramp begins. */
  startTick: number
  /** Tick at which the ramp ends. */
  endTick: number
}

/**
 * Bridge decorator that ramps velocity linearly from startVelocity to endVelocity
 * over the tick range [startTick, endTick].
 *
 * For each note, computes `t = (tick - startTick) / (endTick - startTick)` clamped
 * to [0, 1], then applies `velocity = round(startVelocity + (endVelocity - startVelocity) × t)`.
 * When `precise` is active, the ramp is bypassed and notes use the bridge default
 * or explicitly passed velocity. An explicit velocity argument always overrides
 * the ramped value.
 *
 * Typical use: pp→mf→ff dynamics over a phrase.
 *
 * Immutable — each state transition returns a new `DynamicsBridge` instance.
 *
 * @example
 * ```ts
 * // Crescendo from 64 to 127 over ticks 0–960
 * new DynamicsBridge(bridge, { startVelocity: 64, endVelocity: 127, startTick: 0, endTick: 960 })
 * ```
 *
 * @example
 * ```ts
 * // Decrescendo over a later phrase
 * new DynamicsBridge(bridge, { startVelocity: 127, endVelocity: 40, startTick: 1920, endTick: 2880 })
 * ```
 */
export class DynamicsBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: DynamicsBridgeParams,
  ) {
    super(bridge)
  }

  /**
   * Emit a note with velocity interpolated from the ramp.
   *
   * Progress is computed as (tick - startTick) / (endTick - startTick) and clamped.
   * If an explicit velocity is passed, it overrides the ramp.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in beats. Falls back to `defaultDuration`.
   * @param velocity - Optional velocity override; when provided, ramp is ignored for this note

   * @returns New bridge state with note emitted at ramped velocity
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const { startVelocity, endVelocity, startTick, endTick } = this.params
    const range = endTick - startTick
    const t = range > 0 ? Math.max(0, Math.min(1, (this.tick - startTick) / range)) : 0
    const rampedVelocity = Math.round(startVelocity + (endVelocity - startVelocity) * t)

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity ?? rampedVelocity))
  }

  /** @internal Preserves ramp params when the decorator is re-wrapped. */
  protected rewrap(bridge: CompositionBridge): DynamicsBridge {
    return new DynamicsBridge(bridge, this.params)
  }
}
