import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { resolvePitch } from '../utils/pitch'
import type { NotePitch } from '../types'

export interface AftertouchParams {
  value: number
  note: NotePitch | null
}

/**
 * Aftertouch (pressure) at current tick.
 *
 * Usage:
 *   aftertouch(0.8)                    — channel aftertouch
 *   aftertouch(0.8, 'C4')             — poly aftertouch on C4
 *   aftertouch(0.5).note('D4')         — poly aftertouch on D4
 *   aftertouch(0.5).value(0.9)         — override value
 *
 * Value range: 0–1 (normalized, mapped to 0–127 internally).
 */
export class AftertouchBuilder implements PipeStep {
  private readonly params: AftertouchParams

  constructor(params: Partial<AftertouchParams> = {}) {
    this.params = {
      value: params.value ?? 0,
      note: params.note ?? null,
    }
  }

  /** Set the pressure value (0–1). */
  value(value: number): AftertouchBuilder {
    return this.clone({ value })
  }

  /** Set the target note for poly aftertouch. */
  note(note: NotePitch): AftertouchBuilder {
    return this.clone({ note })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const midiValue = Math.round(Math.min(1, Math.max(0, this.params.value)) * 127)

    if (this.params.note !== null) {
      const pitch = resolvePitch(this.params.note)
      return bridge.withAftertouch(midiValue, pitch)
    }

    return bridge.withAftertouch(midiValue)
  }

  private clone(overrides: Partial<AftertouchParams>): AftertouchBuilder {
    return new AftertouchBuilder({ ...this.params, ...overrides })
  }
}
