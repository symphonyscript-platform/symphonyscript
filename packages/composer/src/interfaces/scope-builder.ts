import { PipeStep } from '@symphonyscript/composer'

/**
 * Interface for builders that accept scoped content via chained steps.
 * Extends {@link PipeStep} with a fluent `steps()` method. Implementations such
 * as {@link ScopedBuilder} and {@link ScopedStepBuilder} use this to apply
 * effects or transforms only to the contained steps.
 *
 * The self-referential generic `T extends ScopeBuilder<T>` enables method
 * chaining that returns the concrete builder type.
 */
export interface ScopeBuilder<T extends ScopeBuilder<T>> extends PipeStep {
  /**
   * Add pipe steps to this scope. Returns the builder with the appended steps
   * (implementations typically return the concrete builder for chaining).
   *
   * @param pipeSteps - One or more {@link PipeStep}s to run within this scope
   * @returns Builder instance with the additional steps (typically `this` subtype)
   */
  steps(...pipeSteps: PipeStep[]): T
}
