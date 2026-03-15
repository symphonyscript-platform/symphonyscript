import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface HumanizationBridgeParams {
  velocityJitter: number
  timingAmount: number
  rng: SeededRandom
}

export class HumanizationBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: HumanizationBridgeParams,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): HumanizationBridge {
    if (this.precise) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    const vel = (velocity ?? this.velocity) + this.jitter(this.params.velocityJitter)
    const tickOffset = this.jitter(this.params.timingAmount)

    return this.rewrap(
      this.bridge
        .withTick(this.tick + tickOffset)
        .withNote(pitch, duration, vel)
    )
  }

  protected rewrap(bridge: CompositionBridge): HumanizationBridge {
    return new HumanizationBridge(
      bridge,
      this.params,
    )
  }

  private jitter(amount: number): number {
    return (this.params.rng.next() * 2 - 1) * amount
  }
}
