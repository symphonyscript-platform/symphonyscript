import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export class TieBridge extends CompositionBridgeDecorator {
  private readonly lastPitch: number | null
  private readonly accumulatedDuration: number

  constructor(
    bridge: CompositionBridge,
    lastPitch: number | null = null,
    accumulatedDuration: number = 0,
  ) {
    super(bridge)
    this.lastPitch = lastPitch
    this.accumulatedDuration = accumulatedDuration
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    const dur = duration ?? this.defaultDuration

    if (this.lastPitch === pitch) {
      // Same pitch — extend by accumulating duration, skip emitting
      return new TieBridge(
        this.bridge.withTick(this.tick + dur),
        pitch,
        this.accumulatedDuration + dur,
      )
    }

    // Different pitch — flush previous tied note, start new tie
    let target = this.flush()
    target = target.withNote(pitch, dur, velocity)

    return new TieBridge(
      target,
      pitch,
      dur,
    )
  }

  /**
   * Flush the accumulated tied note to the inner bridge.
   * Called when a different pitch arrives or when tie() ends.
   */
  flush(): CompositionBridge {
    if (this.lastPitch !== null && this.accumulatedDuration > 0) {
      const emitTick = this.tick - this.accumulatedDuration
      return this.bridge
        .withTick(emitTick)
        .withNote(this.lastPitch, this.accumulatedDuration)
        .withTick(this.tick)
    }

    return this.bridge
  }

  protected rewrap(bridge: CompositionBridge): TieBridge {
    return new TieBridge(bridge, this.lastPitch, this.accumulatedDuration)
  }
}
