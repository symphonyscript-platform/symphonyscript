import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedEffectBuilder } from './ScopedEffectBuilder'

export interface BendParams {
  value: number
  pipeSteps: PipeStep[]
}

export class BendBuilder extends ScopedEffectBuilder<BendBuilder> {
  private readonly _value: number

  constructor(params: Partial<BendParams>) {
    super(params.pipeSteps ?? [])
    this._value = params.value ?? 0
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(this._value)
  }

  protected cloneWithSteps(pipeSteps: PipeStep[]): BendBuilder {
    return new BendBuilder({ value: this._value, pipeSteps })
  }

  /** Reset bend to 0 after scoped steps complete. */
  protected cleanup(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(0)
  }

  private clone(overrides: Partial<BendParams>): BendBuilder {
    return new BendBuilder({ value: this._value, pipeSteps: this.pipeSteps, ...overrides })
  }

  value(value: number): BendBuilder {
    return this.clone({ value })
  }
}
