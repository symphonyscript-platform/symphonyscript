import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToPitch } from '@symphonyscript/theory'
import { ScaleMode } from '@symphonyscript/notations'
import { degreeToCents } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

/**
 * C0 in MIDI = 12 (MIDI 0 = C-1).
 */
const MIDI_C0 = 12

/**
 * Parameters for {@link DegreeBuilder}.
 *
 * Extends {@link PitchStepParams} with scale degree (1–7, 8 = tonic above, 0 = 7th below).
 */
export interface DegreeParams extends PitchStepParams {
  /** Scale degree (1–7; 8 = tonic octave above; 0 = 7th degree one octave below). Default: 1. */
  degree: number
}

/**
 * Immutable builder that emits a single pitch from a scale degree.
 *
 * If the bridge has `scaleIntervals` (continuous pitch), resolves via
 * `degreeToCents()` from Theory. Otherwise falls back to legacy
 * `degreeToPitch()` for backward compatibility.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * degree(1)                           // Tonic
 * degree(5).velocity(1000)             // Dominant, louder
 * degree(3).up(1).duration(480)        // Mediant an octave up, half-note
 * degree(1).repeat(3)                  // Emit tonic three times
 * degree(7).sharp().apply(bridge)      // Leading tone sharpened (+100 cents)
 * ```
 */
export class DegreeBuilder extends PitchStepBuilder<DegreeBuilder> {
  private readonly _degree: number

  constructor(params: Partial<DegreeParams>) {
    super(params)
    this._degree = params.degree ?? 1
  }

  /**
   * Set the scale degree. 1 = tonic, 7 = leading tone; 8 = tonic octave above; 0 = 7th degree one octave below.
   *
   * @param degree - Scale degree (1–7 typical; 8 = tonic above; 0 = 7th below; negative/high values wrap via modulo)
   *
   * @returns New DegreeBuilder with the updated degree
   */
  degree(degree: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.shared, degree })
  }

  /**
   * Resolve the degree to pitch and emit note(s).
   *
   * If bridge has `scaleIntervals` → uses `degreeToCents()` → absolute cents.
   * Otherwise falls back to legacy `degreeToPitch()` → MIDI → cents.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with note(s) emitted, or unchanged if resolution fails
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let finalCents: number

    if (bridge.scaleIntervals !== null) {
      // --- Continuous pitch path ---
      const degreeCents = degreeToCents(bridge.scaleIntervals, this._degree)
      finalCents = bridge.scaleRootCents
        + degreeCents
        + this.shared.accidental
        + (this.shared.octaveShift * 1200)
        + this.shared.transposeCents
    } else {
      // --- Legacy fallback: degreeToPitch() → MIDI → cents ---
      const pitch = degreeToPitch(
        this._degree,
        bridge.scaleRoot,
        bridge.scaleMode as ScaleMode,
        4,
        0, // accidental + transpose applied in cents below
        0, // octaveShift applied in cents below
      )

      if (pitch === null) return bridge

      // Convert MIDI to cents, then apply cents-based modifiers
      finalCents = (pitch - MIDI_C0) * 100
        + this.shared.accidental
        + (this.shared.octaveShift * 1200)
        + this.shared.transposeCents
    }

    let target = this.applyFlags(bridge)

    const scaledDuration = this.resolvedDuration()

    for (let i = 0; i < this.shared.repeatCount; ++i) {
      target = target.withNote(
        finalCents,
        scaledDuration,
        this.shared.velocity ?? undefined,
      )
    }

    return this.resetFlags(target)
  }

  /** @internal Creates a new DegreeBuilder preserving the degree. */
  protected create(params: Partial<PitchStepParams>): DegreeBuilder {
    return new DegreeBuilder({ ...params, degree: this._degree })
  }
}
