import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Bridge decorator that probabilistically skips notes.
 * Each withNote() call independently rolls against the probability.
 * Uses a seeded PRNG for reproducibility.
 */
export class ChanceBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly probability: number,
    private seed: number,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    // Advance PRNG
    this.seed = (this.seed * 1664525 + 1013904223) & 0x7fffffff
    const roll = (this.seed & 0xffff) / 0xffff

    if (roll > this.probability) {
      // Skip note — advance tick by duration as if it were a rest
      const actualDuration = duration ?? this.bridge.defaultDuration
      return this.rewrap(this.bridge.withTick(this.bridge.tick + actualDuration))
    }

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  protected rewrap(bridge: CompositionBridge): ChanceBridge {
    return new ChanceBridge(bridge, this.probability, this.seed)
  }
}
