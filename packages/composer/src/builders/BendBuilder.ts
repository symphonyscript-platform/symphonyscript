import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedStepBuilder } from './ScopedStepBuilder'

export interface BendParams {
  value: number
  entries: PipeStep[][]
}

export class BendBuilder extends ScopedStepBuilder<BendBuilder> {
  private readonly _value: number

  constructor(params: Partial<BendParams>) {
    super(params.entries ?? [])
    this._value = params.value ?? 0
  }

  value(value: number): BendBuilder {
    return this.clone({ value })
  }

  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(this._value)
  }

  /** Reset bend to 0 and restore parent state after scoped steps complete. */
  protected onExit(result: CompositionBridge, parent: CompositionBridge): CompositionBridge {
    return parent.withTick(result.tick).withBend(0)
  }

  protected cloneWithEntries(entries: PipeStep[][]): BendBuilder {
    return new BendBuilder({ value: this._value, entries })
  }

  private clone(overrides: Partial<BendParams>): BendBuilder {
    return new BendBuilder({ value: this._value, entries: this.entries, ...overrides })
  }
}
