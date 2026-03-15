import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface QuantizationBridgeParams {
  grid: number      // grid size in ticks
  strength: number  // 0.0 = no quantize, 1.0 = full snap
}

export class QuantizationBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: QuantizationBridgeParams,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const nearest = Math.round(this.tick / this.params.grid) * this.params.grid
    const quantized = Math.round(this.tick + (nearest - this.tick) * this.params.strength)

    return this.rewrap(
      this.bridge.withTick(quantized).withNote(pitch, duration, velocity)
    )
  }

  protected rewrap(bridge: CompositionBridge): QuantizationBridge {
    return new QuantizationBridge(bridge, this.params)
  }
}
