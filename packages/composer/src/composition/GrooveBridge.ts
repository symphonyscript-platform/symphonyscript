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
  seed: number
}

export class GrooveBridge extends CompositionBridgeDecorator {
  private readonly seed: number

  constructor(bridge: CompositionBridge, private readonly params: GrooveBridgeParams) {
    super(bridge)
    this.seed = params.seed
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    const stepIndex = Math.floor(this.tick / this.params.grid) % this.params.steps.length
    const step = this.params.steps[stepIndex]

    // Advance PRNG
    const nextSeed = (this.seed * 1664525 + 1013904223) & 0x7fffffff

    if (step.probability < 1.0 && ((nextSeed & 0xffff) / 0xffff) > step.probability) {
      return new GrooveBridge(
        this.bridge.withTick(this.tick + (duration ?? this.defaultDuration)),
        { ...this.params, seed: nextSeed },
      )
    }

    const vel = Math.round((velocity ?? this.velocity) * step.velocity)
    const tickOffset = Math.round(step.timing * this.params.grid)

    return new GrooveBridge(
      this.bridge
        .withTick(this.tick + tickOffset)
        .withNote(pitch, duration, vel),
      { ...this.params, seed: nextSeed },
    )
  }

  protected rewrap(bridge: CompositionBridge): GrooveBridge {
    return new GrooveBridge(bridge, this.params)
  }
}

