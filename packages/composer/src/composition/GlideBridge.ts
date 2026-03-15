import { CompositionBridge } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export class GlideBridge extends CompositionBridgeDecorator {
  private readonly activated: boolean

  constructor(bridge: CompositionBridge, activated: boolean = false) {
    super(bridge)
    this.activated = activated
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (!this.activated) {
      // First note — enable portamento, then emit
      const bridgeWithPortamento = this.bridge.withCC(MIDI_CC.PORTAMENTO, 127)
      return new GlideBridge(bridgeWithPortamento.withNote(pitch, duration, velocity), true)
    }

    // Subsequent notes — portamento already active, just emit
    return new GlideBridge(this.bridge.withNote(pitch, duration, velocity), true)
  }

  /**
   * Disable portamento after glide group ends.
   */
  flush(): CompositionBridge {
    if (this.activated) {
      return this.bridge.withCC(MIDI_CC.PORTAMENTO, 0)
    }

    return this.bridge
  }

  protected rewrap(bridge: CompositionBridge): GlideBridge {
    return new GlideBridge(bridge, this.activated)
  }
}
