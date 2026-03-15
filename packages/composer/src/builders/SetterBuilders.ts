import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedStepBuilder } from './ScopedStepBuilder'

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
export class FieldSetter extends ScopedStepBuilder<FieldSetter> {
  constructor(
    private readonly setter: Setter,
    private readonly restorer: Restorer,
    entries: PipeStep[][] = [],
  ) {
    super(entries)
  }

  protected onEnter(bridge: CompositionBridge) { return this.setter(bridge) }

  protected onExit(result: CompositionBridge, parent: CompositionBridge) {
    return this.restorer(result, parent)
  }

  protected cloneWithEntries(entries: PipeStep[][]): FieldSetter {
    return new FieldSetter(this.setter, this.restorer, entries)
  }
}
