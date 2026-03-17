import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'

/**
 * Parameters for {@link GlissandoBuilder}.
 *
 * Defines the chromatic slide from one pitch to another.
 */
export interface GlissandoParams {
  /** Start pitch (note name or cents). Resolved via notation.noteToCents() at apply-time. */
  from: NotePitch | null
  /** End pitch (note name or cents). Resolved via notation.noteToCents() at apply-time. */
  to: NotePitch | null
  /** Total tick duration for the slide. `null` = use bridge default at apply-time. */
  duration: number | null
}

/**
 * Immutable builder for chromatic glissando (slide) between two pitches.
 *
 * Emits discrete 100-cent (semitone) steps from `from` to `to` over the given
 * duration. Each step receives an equal share of `duration / stepCount`. Does not
 * extend {@link PitchStepBuilder}; uses its own param model.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * glissando('C4', 'G4')                        // Chromatic slide C4→G4
 * glissando(6000, 7200).duration(480)          // One octave over 480 ticks
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
   * @param to - Note name (e.g. `'G4'`) or absolute cents
   *
   * @returns New GlissandoBuilder with the updated end pitch
   */
  to(to: NotePitch): GlissandoBuilder {
    return this.clone({ to })
  }

  /**
   * Set the start pitch of the glissando.
   *
   * @param from - Note name (e.g. `'C4'`) or absolute cents
   *
   * @returns New GlissandoBuilder with the updated start pitch
   */
  from(from: NotePitch): GlissandoBuilder {
    return this.clone({ from })
  }

  /**
   * Set the total tick duration for the slide.
   *
   * Duration is divided equally across chromatic steps.
   *
   * @param duration - Ticks for the full glissando
   *
   * @returns New GlissandoBuilder with the updated duration
   */
  duration(duration: number): GlissandoBuilder {
    return this.clone({ duration })
  }

  /**
   * Emit chromatic 100-cent steps from start to end pitch.
   *
   * **Pipeline:**
   * 1. Resolve `from` and `to` via `notation.noteToCents()`
   * 2. Compute step count and direction (100 cents per step)
   * 3. Emit each pitch at `duration / stepCount` ticks per step
   *
   * Returns the bridge unchanged when `from` or `to` is null. When
   * start and end are identical, emits a single note at that pitch.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with glissando notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.from === null || this.params.to === null) return bridge

    const notation = bridge.notation()
    const fromCents = notation.noteToCents(this.params.from)
    const toCents = notation.noteToCents(this.params.to)
    const duration = this.params.duration ?? bridge.defaultDuration

    const direction = toCents > fromCents ? 100 : -100
    const stepCount = Math.abs(toCents - fromCents) / 100

    if (stepCount === 0) {
      return bridge.withNote(fromCents, duration)
    }

    const stepDuration = Math.round(duration / stepCount)
    let target = bridge

    for (let i = 0; i <= stepCount; ++i) {
      const currentPitch = fromCents + (i * direction)
      target = target.withNote(currentPitch, stepDuration)
    }

    return target
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<GlissandoParams>): GlissandoBuilder {
    return new GlissandoBuilder({ ...this.params, ...overrides })
  }
}
