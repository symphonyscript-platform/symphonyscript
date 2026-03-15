import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface DynamicsBridgeParams {
  startVelocity: number // velocity at start tick
  endVelocity: number   // velocity at end tick
  startTick: number     // range start
  endTick: number       // range end
}

export class DynamicsBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: DynamicsBridgeParams,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const { startVelocity, endVelocity, startTick, endTick } = this.params
    const range = endTick - startTick
    const t = range > 0 ? Math.max(0, Math.min(1, (this.tick - startTick) / range)) : 0
    const rampedVelocity = Math.round(startVelocity + (endVelocity - startVelocity) * t)

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity ?? rampedVelocity))
  }

  protected rewrap(bridge: CompositionBridge): DynamicsBridge {
    return new DynamicsBridge(bridge, this.params)
  }
}
