import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { GrooveBridge, GrooveBridgeParams, GrooveStep } from '../composition/GrooveBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import type { PipeStep } from '@symphonyscript/composer'
import { KNUTH_MULTIPLIER } from '../constants'

const DEFAULT_STEP: GrooveStep = {
  velocity: 1.0,
  timing: 0,
  probability: 1.0,
}

export interface GrooveParams extends Omit<GrooveBridgeParams, 'rng'> {
  rng: SeededRandom | null
  entries: PipeStep[][]
}

export class GrooveBuilder extends ScopedStepBuilder<GrooveBuilder> {
  private readonly params: Omit<GrooveParams, 'entries'>

  constructor(params: Partial<GrooveParams>) {
    super(params.entries ?? [])
    this.params = {
      steps: params.steps ?? [],
      grid: params.grid ?? 480,
      rng: params.rng ?? null,
    }
  }

  /** Add a groove step. */
  step(velocity?: number, timing?: number, probability?: number): GrooveBuilder {
    const newStep: GrooveStep = {
      velocity: velocity ?? DEFAULT_STEP.velocity,
      timing: timing ?? DEFAULT_STEP.timing,
      probability: probability ?? DEFAULT_STEP.probability,
    }
    return this.clone({ steps: [...this.params.steps, newStep] })
  }

  velocityLast(velocity: number): GrooveBuilder {
    return this.modifyLast({ velocity })
  }

  timingLast(timing: number): GrooveBuilder {
    return this.modifyLast({ timing })
  }

  probabilityLast(probability: number): GrooveBuilder {
    return this.modifyLast({ probability })
  }

  grid(grid: number): GrooveBuilder {
    return this.clone({ grid })
  }

  seed(seed: number): GrooveBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    const rng = this.params.rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new GrooveBridge(bridge, { ...this.params, rng })
  }

  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  protected cloneWithEntries(entries: PipeStep[][]): GrooveBuilder {
    return new GrooveBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<GrooveParams>): GrooveBuilder {
    return new GrooveBuilder({
      ...this.params,
      entries: this.entries,
      ...overrides,
    })
  }

  private modifyLast(overrides: Partial<GrooveStep>): GrooveBuilder {
    const currentSteps = this.params.steps

    if (currentSteps.length === 0) {
      return this.step(overrides.velocity, overrides.timing, overrides.probability)
    }

    const last = currentSteps[currentSteps.length - 1]
    const updated = [...currentSteps]

    updated[updated.length - 1] = { ...last, ...overrides }

    return this.clone({ steps: updated })
  }
}
