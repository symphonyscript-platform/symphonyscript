import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedSetterBuilder } from './ScopedSetterBuilder'

// ============================================================================
// FieldSetter — generic scoped setter for any bridge state field
// ============================================================================

type Setter = (bridge: CompositionBridge) => CompositionBridge
type Restorer = (result: CompositionBridge, parent: CompositionBridge) => CompositionBridge

/**
 * Generic setter builder. One class for all bridge state field setters.
 *
 * Parameterized by closure-captured setter/restorer functions.
 */
export class FieldSetter extends ScopedSetterBuilder<FieldSetter> {
  constructor(
    private readonly setter: Setter,
    private readonly restorer: Restorer,
    entries: PipeStep[][] = [],
  ) {
    super(entries)
  }

  protected set(bridge: CompositionBridge) { return this.setter(bridge) }

  protected restore(result: CompositionBridge, parent: CompositionBridge) {
    return this.restorer(result, parent)
  }

  protected cloneWithEntries(entries: PipeStep[][]): FieldSetter {
    return new FieldSetter(this.setter, this.restorer, entries)
  }
}
