import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { GrooveBridge, GrooveBridgeParams, GrooveStep } from '../composition/GrooveBridge'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

const DEFAULT_STEP: GrooveStep = {
  velocity: 1.0,
  timing: 0,
  probability: 1.0,
}

export interface GrooveParams extends GrooveBridgeParams {
  pipeSteps: PipeStep[]
}

export class GrooveBuilder extends ScopedEffectBuilder<GrooveBuilder> {
  private readonly params: GrooveBridgeParams

  constructor(params: Partial<GrooveParams>) {
    super(params.pipeSteps ?? [])
    this.params = {
      steps: params.steps ?? [],
      grid: params.grid ?? 480,
    }
  }

  grid(grid: number): GrooveBuilder {
    return this.clone({ grid })
  }

  step(): GrooveBuilder {
    return this.clone({
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

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new GrooveBridge(bridge, this.params)
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): GrooveBuilder {
    return new GrooveBuilder({ ...this.params, pipeSteps })
  }

  private clone(overrides: Partial<GrooveParams>): GrooveBuilder {
    return new GrooveBuilder({ ...this.params, pipeSteps: this.pipeSteps, ...overrides })
  }

  private modifyLast(overrides: Partial<GrooveStep>): GrooveBuilder {
    const grooveSteps = [...this.params.steps]

    if (grooveSteps.length === 0) return this

    grooveSteps[grooveSteps.length - 1] = { ...grooveSteps[grooveSteps.length - 1], ...overrides }

    return this.clone({ steps: grooveSteps })
  }
}
