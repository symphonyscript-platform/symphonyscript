import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface SwingBridgeParams {
  amount: number  // 0.0 = straight, 0.5 = triplet swing, 1.0 = dotted swing
  grid: number    // grid division in ticks (e.g., 480 for 8th notes at 960 PPQ)
}

export class SwingBridge extends CompositionBridgeDecorator {
  constructor(bridge: CompositionBridge, private readonly params: SwingBridgeParams) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const position = this.tick % (this.params.grid * 2)
    const isOffbeat = position >= this.params.grid

    if (isOffbeat) {
      const offset = Math.round(this.params.amount * this.params.grid * 0.5)
      return this.rewrap(
        this.bridge.withTick(this.tick + offset).withNote(pitch, duration, velocity)
      )
    }

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  protected rewrap(bridge: CompositionBridge): SwingBridge {
    return new SwingBridge(bridge, this.params)
  }
}
