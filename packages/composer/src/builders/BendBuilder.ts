import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedEffectBuilder, ScopeEntry } from './ScopedEffectBuilder'

export interface BendParams {
  value: number
  entries: ScopeEntry[]
}

export class BendBuilder extends ScopedEffectBuilder<BendBuilder> {
  private readonly _value: number

  constructor(params: Partial<BendParams>) {
    super(params.entries ?? [])
    this._value = params.value ?? 0
  }

  value(value: number): BendBuilder {
    return this.clone({ value })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(this._value)
  }

  protected cloneWithEntries(entries: ScopeEntry[]): BendBuilder {
    return new BendBuilder({ value: this._value, entries })
  }

  /** Reset bend to 0 after scoped steps complete. */
  protected override cleanup(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(0)
  }

  private clone(overrides: Partial<BendParams>): BendBuilder {
    return new BendBuilder({ value: this._value, entries: this.entries, ...overrides })
  }
}
