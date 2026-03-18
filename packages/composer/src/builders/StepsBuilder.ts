import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { applyBinaryPattern } from '../utils/binary-pattern'
import { NotePitch } from '@symphonyscript/core'

/**
 * Parameters for {@link StepsBuilder}.
 *
 * Used when constructing via the factory or when cloning. All fields have defaults.
 */
export interface StepsParams {
  /**
   * Binary step pattern: 1 (or truthy) = hit (emit note), 0 (or falsy) = rest.
   * Pitches cycle through `notes` on each hit.
   */
  pattern: number[]
  /**
   * Pitches to cycle through on hits. Resolved via notation.noteToCents() at apply-time.
   * Strings (e.g. `'C4'`, `'F#5'`) or cents.
   */
  notes: NotePitch[]
  /**
   * Duration in ticks per step (for both hits and rests).
   * `null` = use bridge default duration at apply-time.
   */
  stepDuration: number | null
}

/**
 * Immutable builder for binary step-pattern emission.
 *
 * Emits notes on pattern hits (1) and advances tick on rests (0), cycling through
 * the note array. Does not extend {@link PitchStepBuilder}; implements {@link PipeStep}
 * directly. Use the `steps()` factory from `@symphonyscript/composer` (or `melody.steps`).
 *
 * All modifier methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * steps([1, 0, 1], ['C4', 'E4'])              // C4, rest, E4; cycles pitches on hits
 * steps([1, 1, 1], ['C4', 'E4'])              // C4, E4, C4
 * steps([1, 0, 1, 0], ['C4', 'E4'], 120)     // Explicit 120-tick step duration
 * steps().pattern([1, 1]).notes(['G4'])       // Builder-style configuration
 * steps([0, 0], ['C4'])                       // No notes; advances tick only
 * ```
 */
export class StepsBuilder implements PipeStep {
  private readonly params: StepsParams

  constructor(params: Partial<StepsParams>) {
    this.params = {
      pattern: params.pattern ?? [],
      notes: params.notes ?? [],
      stepDuration: params.stepDuration ?? null,
    }
  }

  /**
   * Replace the binary step pattern.
   *
   * @param pattern - Array of 0/1 (or truthy/falsy); 1 = hit, 0 = rest

   * @returns New StepsBuilder with the updated pattern
   */
  pattern(pattern: number[]): StepsBuilder {
    return this.clone({ pattern })
  }

  /**
   * Replace the pitches cycled through on hits.
   *
   * Resolved via {@link Notation.noteToCents notation.noteToCents()} at apply-time; invalid strings throw.
   *
   * @param notes - Array of literal note names or MIDI numbers (0–127)

   * @returns New StepsBuilder with the updated notes
   */
  notes(notes: NotePitch[]): StepsBuilder {
    return this.clone({ notes })
  }

  /**
   * Set the duration in ticks per step (for both hits and rests).
   *
   * When unset (`null`), the bridge default duration is used at apply-time.
   *
   * @param stepDuration - Duration in ticks

   * @returns New StepsBuilder with the updated step duration
   */
  stepDuration(stepDuration: number): StepsBuilder {
    return this.clone({ stepDuration })
  }

  /**
   * Apply the binary pattern to the bridge and emit notes on hits.
   *
   * For each pattern step: a truthy value emits the next pitch in the cycle and
   * advances tick by the step duration; a falsy value advances tick only (rest).
   * Returns the bridge unchanged when `pattern` or `notes` is empty.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with notes emitted on hits; tick advanced for full pattern
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pattern.length === 0 || this.params.notes.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    const notation = bridge.notation()
    const pitches = this.params.notes.map(p => notation.noteToCents(p))

    return applyBinaryPattern(this.params.pattern, pitches, duration, bridge)
  }

  /** @internal Creates a new StepsBuilder preserving params. */
  private clone(overrides: Partial<StepsParams>): StepsBuilder {
    return new StepsBuilder({ ...this.params, ...overrides })
  }
}
