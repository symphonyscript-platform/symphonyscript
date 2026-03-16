import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ScopedStepBuilder } from './ScopedStepBuilder'

// ============================================================================
// FieldSetter — generic scoped setter for any bridge state field
// ============================================================================

/** Sets a bridge field on enter; called by {@link FieldSetter} before running scoped steps. */
type Setter = (bridge: CompositionBridge) => CompositionBridge

/** Restores the original field from parent; called by {@link FieldSetter} after scoped steps. */
type Restorer = (result: CompositionBridge, parent: CompositionBridge) => CompositionBridge

/**
 * Generic scoped setter for any bridge state field (velocity, tempo, transpose, etc.).
 *
 * Parameterized by closure-captured setter/restorer functions. cue factories
 * such as `velocity()`, `tempo()`, `transpose()`, `duration()`, `scale()`,
 * `key()`, `volume()`, `pan()`, `octaveUp()`, `precise()` return FieldSetter instances.
 *
 * Extends {@link ScopedStepBuilder}: in scoped mode, the field change applies only
 * to contained steps; in default mode (no steps or after `.default()`), it cascades
 * downstream for subsequent pipeline steps.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * velocity(800).steps(note('C4'), note('E4'))   // Scoped: only these notes at 800
 * tempo(120).default()                         // Cascade: all downstream at 120 BPM
 * transpose(12).steps(note('C4'))              // C4 → C5 within scope only
 * octaveUp(1).steps(chord('Am'))               // Am an octave higher, scoped
 * ```
 */
export class FieldSetter extends ScopedStepBuilder<FieldSetter> {
  /**
   * Create a field setter with custom setter/restorer logic.
   *
   * @param setter - Applies the field change to the bridge before scoped steps
   * @param restorer - Restores the original field from parent after scoped steps
   * @param entries - Pipe-step groups (default `[]` for cascade mode)
   */
  constructor(
    private readonly setter: Setter,
    private readonly restorer: Restorer,
    entries: PipeStep[][] = [],
  ) {
    super(entries)
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge) { return this.setter(bridge) }

  /** @internal */
  protected onExit(result: CompositionBridge, parent: CompositionBridge) {
    return this.restorer(result, parent)
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): FieldSetter {
    return new FieldSetter(this.setter, this.restorer, entries)
  }
}
