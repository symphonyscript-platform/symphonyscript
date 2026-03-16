import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedStepBuilder } from './ScopedStepBuilder'

/**
 * Parameters for {@link BendBuilder}.
 *
 * Extends scoped entries with the pitch-bend value to apply.
 */
export interface BendParams {
  /** Pitch bend value applied before note onset (passed to {@link CompositionBridge.withBend}). */
  value: number
  /** Pipe-step groups run within this bend scope. From {@link ScopedStepBuilder}. */
  entries: PipeStep[][]
}

/**
 * Immutable builder for pitch-bend effects within a scope.
 *
 * Extends {@link ScopedStepBuilder}. In scoped mode, sets pitch bend via
 * `onEnter`, runs contained steps, then resets bend to 0 in `onExit`.
 * In default mode (`steps()` omitted or `default()`), the bend cascades downstream.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * bend(64).steps(note('C4'), note('D4'))    // Bend 64 applies only to inner notes
 * bend(-32).default()                       // Cascade bend downstream
 * bend(127).value(64).steps(note('E4'))     // Override to 64 for scoped step
 * ```
 */
export class BendBuilder extends ScopedStepBuilder<BendBuilder> {
  private readonly _value: number

  constructor(params: Partial<BendParams>) {
    super(params.entries ?? [])
    this._value = params.value ?? 0
  }

  /**
   * Set the pitch bend value applied before note onset within the scope.
   *
   * @param value - Pitch bend value (e.g. 0 = center, 64 = up, -64 = down)

   * @returns New BendBuilder with the updated value
   */
  value(value: number): BendBuilder {
    return this.clone({ value })
  }

  /**
   * Apply pitch bend to the bridge before scoped steps run.
   *
   * Delegates to {@link CompositionBridge.withBend} with the configured value.
   *
   * @param bridge - Current composition state before scoped content

   * @returns Bridge with pitch bend set
   */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return bridge.withBend(this._value)
  }

  /**
   * Reset pitch bend to 0 after scoped steps complete.
   *
   * Ensures the bend does not leak to subsequent pipeline steps.
   *
   * @param result - Bridge state after inner steps were applied
   * @param _parent - Original bridge before this step (unused)

   * @returns Bridge with bend reset to 0
   */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return result.withBend(0)
  }

  /** @internal Clone with updated entries, preserving bend value. */
  protected cloneWithEntries(entries: PipeStep[][]): BendBuilder {
    return new BendBuilder({ value: this._value, entries })
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<BendParams>): BendBuilder {
    return new BendBuilder({ value: this._value, entries: this.entries, ...overrides })
  }
}
