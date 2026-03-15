import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export type EasingCurve = 'linear' | 'exponential' | 'smooth'

export interface VelocityRampParams {
  startTick: number
  endTick: number
  fromVelocity: number
  toVelocity: number
  curve: EasingCurve
}

/**
 * Bridge decorator that intercepts withNote() and scales velocity
 * based on tick position within a ramp window.
 */
export class VelocityRampBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly ramp: VelocityRampParams,
  ) {
    super(bridge)
  }

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

  protected rewrap(bridge: CompositionBridge): VelocityRampBridge {
    return new VelocityRampBridge(bridge, this.ramp)
  }

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
