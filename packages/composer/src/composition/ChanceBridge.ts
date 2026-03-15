import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Bridge decorator that probabilistically skips notes.
 * Each withNote() call independently rolls against the probability.
 * Uses a SeededRandom for reproducibility.
 */
export class ChanceBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly probability: number,
    private readonly rng: SeededRandom,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (!this.rng.bool(this.probability)) {
      // Skip note — advance tick by duration as if it were a rest
      const actualDuration = duration ?? this.bridge.defaultDuration
      return this.rewrap(this.bridge.withTick(this.bridge.tick + actualDuration))
    }

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  protected rewrap(bridge: CompositionBridge): ChanceBridge {
    return new ChanceBridge(bridge, this.probability, this.rng)
  }
}
