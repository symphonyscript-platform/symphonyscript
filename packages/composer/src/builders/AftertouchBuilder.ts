import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

import { NotePitch } from '@symphonyscript/core'

/**
 * Parameters for {@link AftertouchBuilder}.
 */
export interface AftertouchParams {
  /** Normalized pressure (0–1), mapped to MIDI 0–127. Default 0. */
  value: number
  /** Target note for poly aftertouch. `null` = channel aftertouch. Default null. */
  note: NotePitch | null
}

/**
 * Aftertouch (channel or polyphonic pressure) at the current tick. Implements
 * {@link PipeStep}; emits a single CC event. Does not extend {@link ScopedStepBuilder}
 * — it is a leaf step with no inner content.
 *
 * Omit `note` for channel aftertouch (0xD0); provide a pitch for poly aftertouch
 * (0xA0). Value is clamped to 0–1 and scaled to 0–127. All builder methods
 * return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * aftertouch(0.8)                    // Channel aftertouch
 * aftertouch(0.8, 'C4')              // Poly aftertouch on C4
 * aftertouch(0.5).note('D4')         // Poly aftertouch on D4
 * aftertouch(0.5).value(0.9)         // Override value
 * ```
 */
export class AftertouchBuilder implements PipeStep {
  private readonly params: AftertouchParams

  constructor(params: Partial<AftertouchParams> = {}) {
    this.params = {
      value: params.value ?? 0,
      note: params.note ?? null,
    }
  }

  /**
   * Set the pressure value. Normalized 0–1, mapped to MIDI 0–127 on apply.
   *
   * @param value - Normalized pressure (0–1). Clamped on apply.

   * @returns New builder with the updated value
   */
  value(value: number): AftertouchBuilder {
    return this.clone({ value })
  }

  /**
   * Set the target note for polyphonic aftertouch. Omit or clear for channel aftertouch.
   *
   * @param note - String (e.g. 'C4') or MIDI number. Resolved via {@link Notation.noteToCents notation.noteToCents()}

   * @returns New builder with the target note
   */
  note(note: NotePitch): AftertouchBuilder {
    return this.clone({ note })
  }

  /**
   * Emit the aftertouch CC event onto the bridge at the current tick. Value
   * is clamped to 0–1 and scaled to 0–127. With a note, emits poly aftertouch;
   * without, emits channel aftertouch.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with aftertouch event emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const midiValue = Math.round(Math.min(1, Math.max(0, this.params.value)) * 127)

    if (this.params.note !== null) {
      const pitch = bridge.notation().noteToCents(this.params.note)
      return bridge.withAftertouch(midiValue, pitch)
    }

    return bridge.withAftertouch(midiValue)
  }

  /** @internal */
  private clone(overrides: Partial<AftertouchParams>): AftertouchBuilder {
    return new AftertouchBuilder({ ...this.params, ...overrides })
  }
}
