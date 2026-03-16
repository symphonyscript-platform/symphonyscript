import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

/**
 * Parameters for {@link GlissandoBuilder}.
 *
 * Defines the chromatic slide from one pitch to another.
 */
export interface GlissandoParams {
  /** Start pitch (literal note name or MIDI number). Resolved via {@link resolvePitch}. */
  from: NotePitch | null
  /** End pitch (literal note name or MIDI number). Resolved via {@link resolvePitch}. */
  to: NotePitch | null
  /** Total tick duration for the slide. `null` = use bridge default at apply-time. */
  duration: number | null
}

/**
 * Immutable builder for chromatic glissando (slide) between two pitches.
 *
 * Emits discrete semitone steps from `from` to `to` over the given duration.
 * Each step receives an equal share of `duration / semitoneCount`. Does not
 * extend {@link PitchStepBuilder}; uses its own param model.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * glissando('C4', 'G4')                        // Chromatic slide C4→G4
 * glissando(60, 72).duration(480)              // One octave over 480 ticks
 * glissando('A3', 'A4').duration(960)           // Octave slide, half-note total
 * glissando().from('E4').to('E5')              // Set via builders
 * ```
 */
export class GlissandoBuilder implements PipeStep {
  private readonly params: GlissandoParams

  constructor(params: Partial<GlissandoParams>) {
    this.params = {
      from: params.from ?? null,
      to: params.to ?? null,
      duration: params.duration ?? null,
    }
  }

  /**
   * Set the end pitch of the glissando.
   *
   * @param to - Literal note name (e.g. `'G4'`) or MIDI number

   * @returns New GlissandoBuilder with the updated end pitch
   */
  to(to: NotePitch): GlissandoBuilder {
    return this.clone({ to })
  }

  /**
   * Set the start pitch of the glissando.
   *
   * @param from - Literal note name (e.g. `'C4'`) or MIDI number

   * @returns New GlissandoBuilder with the updated start pitch
   */
  from(from: NotePitch): GlissandoBuilder {
    return this.clone({ from })
  }

  /**
   * Set the total tick duration for the slide.
   *
   * Duration is divided equally across semitone steps.
   *
   * @param duration - Ticks for the full glissando

   * @returns New GlissandoBuilder with the updated duration
   */
  duration(duration: number): GlissandoBuilder {
    return this.clone({ duration })
  }

  /**
   * Emit chromatic semitone steps from start to end pitch.
   *
   * **Pipeline:**
   * 1. Resolve `from` and `to` via {@link resolvePitch}
   * 2. Compute semitone count and direction
   * 3. Emit each pitch at `duration / semitoneCount` ticks per step
   *
   * Returns the bridge unchanged when `from` or `to` is null. When
   * start and end are identical, emits a single note at that pitch.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with glissando notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.from === null || this.params.to === null) return bridge

    const fromMidi = resolvePitch(this.params.from)
    const toMidi = resolvePitch(this.params.to)
    const duration = this.params.duration ?? bridge.defaultDuration

    const direction = toMidi > fromMidi ? 1 : -1
    const semitoneCount = Math.abs(toMidi - fromMidi)

    if (semitoneCount === 0) {
      return bridge.withNote(fromMidi, duration)
    }

    const stepDuration = Math.round(duration / semitoneCount)
    let target = bridge

    for (let i = 0; i <= semitoneCount; ++i) {
      const currentPitch = fromMidi + (i * direction)
      target = target.withNote(currentPitch, stepDuration)
    }

    return target
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<GlissandoParams>): GlissandoBuilder {
    return new GlissandoBuilder({ ...this.params, ...overrides })
  }
}
