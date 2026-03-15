import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface GrooveStep {
  velocity: number      // velocity scale (1.0 = normal)
  timing: number        // timing offset in ticks
  probability: number   // probability of sounding (1.0 = always)
}

export interface GrooveBridgeParams {
  steps: readonly GrooveStep[]
  grid: number  // grid division in ticks
}

export class GrooveBridge extends CompositionBridgeDecorator {
  constructor(bridge: CompositionBridge, private readonly params: GrooveBridgeParams) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    const stepIndex = Math.floor(this.tick / this.params.grid) % this.params.steps.length
    const step = this.params.steps[stepIndex]

    if (step.probability < 1.0 && Math.random() > step.probability) {
      return this.rewrap(
        this.bridge
          .withTick(this.tick + (duration ?? this.defaultDuration))
      )
    }

    const vel = Math.round((velocity ?? this.velocity) * step.velocity)
    const tickOffset = Math.round(step.timing * this.params.grid)

    return this.rewrap(
      this.bridge
        .withTick(this.tick + tickOffset)
        .withNote(pitch, duration, vel)
    )
  }

  protected rewrap(bridge: CompositionBridge): GrooveBridge {
    return new GrooveBridge(bridge, this.params)
  }
}
