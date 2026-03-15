import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { GrooveBridge, GrooveBridgeParams, GrooveStep } from '../composition/GrooveBridge'

const DEFAULT_STEP: GrooveStep = {
  velocity: 1.0,
  timing: 0,
  probability: 1.0,
}

export class GrooveBuilder implements PipeStep {
  private readonly params: GrooveBridgeParams

  constructor(params: Partial<GrooveBridgeParams>) {
    this.params = {
      steps: params.steps ?? [],
      grid: params.grid ?? 480,
    }
  }

  grid(grid: number): GrooveBuilder {
    return new GrooveBuilder({ ...this.params, grid })
  }

  step(): GrooveBuilder {
    return new GrooveBuilder({
      ...this.params,
      steps: [...this.params.steps, { ...DEFAULT_STEP }],
    })
  }

  velocity(velocity: number): GrooveBuilder {
    return this.modifyLast({ velocity })
  }

  timing(timing: number): GrooveBuilder {
    return this.modifyLast({ timing })
  }

  probability(probability: number): GrooveBuilder {
    return this.modifyLast({ probability })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    return new GrooveBridge(bridge, this.params)
  }

  private modifyLast(overrides: Partial<GrooveStep>): GrooveBuilder {
    const steps = [...this.params.steps]

    if (steps.length === 0) return this

    steps[steps.length - 1] = { ...steps[steps.length - 1], ...overrides }

    return new GrooveBuilder({ ...this.params, steps })
  }
}
