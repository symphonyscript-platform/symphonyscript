import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'
import type { AccidentalOverride } from '@symphonyscript/theory'

/**
 * Shared parameters for pitched step builders ({@link NoteBuilder}, {@link HarmonyBuilder}, etc.).
 *
 * Subclasses extend this with pitch-specific fields (e.g. `mask`, `root`, `rawPitch`).
 */
export interface PitchStepParams {
  /** Note duration in ticks. `null` = use bridge default at apply-time. */
  duration: number | null
  /** Multiplier applied to duration (e.g. 0.5 for staccato). Default: 1.0. */
  durationScale: number
  /** Velocity override. `null` = use bridge default (typically 800). */
  velocity: number | null
  /** Octave shift applied to pitch (e.g. 1 = up one octave). Default: 0. */
  octaveShift: number
  /** Semitone accidental offset (+1 sharp, -1 flat). Used when `accidentalOverride` is not set. */
  accidental: number
  /** Key-signature override for raw string pitches: `'sharp'`, `'flat'`, `'natural'`, or `null`. */
  accidentalOverride: AccidentalOverride | null
  /** When true, bypasses swing, humanization, and groove for precise timing. */
  precise: boolean
  /** When true, note emits without audible sound. */
  muted: boolean
  /** Pitch bend value sent before note onset. `null` = no bend. */
  detune: number | null
  /** CC74 (brightness) value sent before note onset. `null` = no timbre change. */
  timbre: number | null
  /** CC13 (effect 2) value sent before note onset. `null` = no pressure change. */
  pressure: number | null
  /** Number of times to emit the note sequentially. Default: 1. */
  repeatCount: number
  /** Transpose offset in semitones. Default: 0. */
  transposeSemitones: number
  /** Channel aftertouch value sent with the note. `null` = no aftertouch. */
  aftertouch: number | null
}

/**
 * Default values for {@link PitchStepParams}.
 *
 * Used as the base when constructing or merging params in {@link PitchStepBuilder}.
 */
export const DEFAULT_PITCH_STEP_PARAMS: PitchStepParams = {
  duration: null,
  durationScale: 1.0,
  velocity: null,
  octaveShift: 0,
  accidental: 0,
  accidentalOverride: null,
  precise: false,
  muted: false,
  detune: null,
  timbre: null,
  pressure: null,
  repeatCount: 1,
  transposeSemitones: 0,
  aftertouch: null,
}

/**
 * Abstract base for builders that emit pitched notes.
 *
 * Provides shared pitch modifiers (velocity, duration, accidentals, octave shifts,
 * articulations, expression) and implements {@link PipeStep}. Subclasses such as
 * {@link NoteBuilder} and {@link HarmonyBuilder} define `apply()` and `create()`.
 *
 * Uses an immutable builder pattern: each modifier returns a new instance via
 * `create()`, which subclasses implement to preserve their specific state.
 *
 * @example
 * ```ts
 * note('C4').velocity(900).sharp().up(1)     // C#5, velocity 900
 * chord('Cmaj7').duration(480).staccato()    // Half-note chord, staccato
 * note('E4').repeat(3).transpose(2)          // Emit F#4 three times
 * note('G4').muted().detune(64)              // Muted G4 with pitch bend
 * harmony(mask, 60).octave(-1).legato()      // Chord an octave down, full duration
 * ```
 */
export abstract class PitchStepBuilder<T extends PitchStepBuilder<T>> implements PipeStep {
  /** Merged params from {@link DEFAULT_PITCH_STEP_PARAMS} and constructor overrides. */
  protected readonly shared: PitchStepParams

  /** @internal */
  protected constructor(shared: Partial<PitchStepParams>) {
    this.shared = {
      ...DEFAULT_PITCH_STEP_PARAMS,
      ...shared,
    }
  }

  /**
   * Set velocity for emitted notes.
   *
   * @param velocity - Velocity value (0–1000)

   * @returns New builder with the updated velocity
   */
  velocity(velocity: number): T {
    return this.create({ ...this.shared, velocity })
  }

  // === Core Modifiers ===

  /**
   * Set note duration in ticks.
   *
   * @param duration - Duration in ticks

   * @returns New builder with the updated duration
   */
  duration(duration: number): T {
    return this.create({ ...this.shared, duration })
  }

  /**
   * Raise pitch by one semitone (sharp).
   *
   * @returns New builder with accidental offset +1 and override `'sharp'`
   */
  sharp(): T {
    return this.create({ ...this.shared, accidental: this.shared.accidental + 1, accidentalOverride: 'sharp' })
  }

  /**
   * Lower pitch by one semitone (flat).
   *
   * @returns New builder with accidental offset -1 and override `'flat'`
   */
  flat(): T {
    return this.create({ ...this.shared, accidental: this.shared.accidental - 1, accidentalOverride: 'flat' })
  }

  /**
   * Cancel accidentals (natural).
   *
   * For raw string pitches, strips accidentals at key-signature resolution.
   *
   * @returns New builder with accidental 0 and override `'natural'`
   */
  natural(): T {
    return this.create({ ...this.shared, accidental: 0, accidentalOverride: 'natural' })
  }

  /**
   * Set absolute octave shift.
   *
   * @param shift - Octave offset (e.g. 1 = +1 octave, -1 = -1 octave)

   * @returns New builder with the updated octave shift
   */
  octave(shift: number): T {
    return this.create({ ...this.shared, octaveShift: shift })
  }

  /**
   * Move pitch up by one or more octaves.
   *
   * @param octaves - Number of octaves to shift up. Default: 1.

   * @returns New builder with increased octave shift
   */
  up(octaves: number = 1): T {
    return this.create({ ...this.shared, octaveShift: this.shared.octaveShift + octaves })
  }

  /**
   * Move pitch down by one or more octaves.
   *
   * @param octaves - Number of octaves to shift down. Default: 1.

   * @returns New builder with decreased octave shift
   */
  down(octaves: number = 1): T {
    return this.create({ ...this.shared, octaveShift: this.shared.octaveShift - octaves })
  }

  /**
   * Enable precise timing — bypasses swing, humanization, and groove.
   *
   * @returns New builder with precise flag set
   */
  precise(): T {
    return this.create({ ...this.shared, precise: true })
  }

  /**
   * Mute the note (emit without audible sound).
   *
   * @returns New builder with muted flag set
   */
  muted(): T {
    return this.create({ ...this.shared, muted: true })
  }

  /**
   * Emit the note a given number of times sequentially.
   *
   * @param count - Repeat count (≥ 1)

   * @returns New builder with the updated repeat count
   */
  repeat(count: number): T {
    return this.create({ ...this.shared, repeatCount: count })
  }

  /**
   * Transpose pitch by a number of semitones.
   *
   * @param semitones - Transposition offset

   * @returns New builder with the updated transpose
   */
  transpose(semitones: number): T {
    return this.create({ ...this.shared, transposeSemitones: semitones })
  }

  /**
   * Apply accent: high velocity (1000) and precise timing.
   *
   * @returns New builder with velocity 1000 and precise flag set
   */
  accent(): T {
    return this.create({ ...this.shared, velocity: 1000, precise: true })
  }

  // === Articulations ===

  /**
   * Apply staccato (50% of base duration).
   *
   * @returns New builder with durationScale 0.5
   */
  staccato(): T {
    return this.create({ ...this.shared, durationScale: 0.5 })
  }

  /**
   * Apply legato (100% of base duration).
   *
   * @returns New builder with durationScale 1.0
   */
  legato(): T {
    return this.create({ ...this.shared, durationScale: 1.0 })
  }

  /**
   * Apply tenuto (95% of base duration).
   *
   * @returns New builder with durationScale 0.95
   */
  tenuto(): T {
    return this.create({ ...this.shared, durationScale: 0.95 })
  }

  /**
   * Apply marcato: slightly shortened duration (70%) and boosted velocity (+200).
   *
   * @returns New builder with durationScale 0.7, increased velocity, and precise flag set
   */
  marcato(): T {
    return this.create({
      ...this.shared,
      durationScale: 0.7,
      velocity: (this.shared.velocity ?? 800) + 200,
      precise: true,
    })
  }

  /**
   * Set pitch bend value sent before note onset.
   *
   * @param detune - Pitch bend value (passed to {@link CompositionBridge.withBend})

   * @returns New builder with the updated detune
   */
  detune(detune: number): T {
    return this.create({ ...this.shared, detune })
  }

  // === Expression ===

  /**
   * Set CC74 (brightness) value sent before note onset.
   *
   * @param timbre - CC74 value (0–127)

   * @returns New builder with the updated timbre
   */
  timbre(timbre: number): T {
    return this.create({ ...this.shared, timbre })
  }

  /**
   * Set CC13 (effect 2) value sent before note onset.
   *
   * @param pressure - CC13 value (0–127)

   * @returns New builder with the updated pressure
   */
  pressure(pressure: number): T {
    return this.create({ ...this.shared, pressure })
  }

  /**
   * Set channel aftertouch value sent with the note.
   *
   * @param aftertouch - Aftertouch value (0–127)

   * @returns New builder with the updated aftertouch
   */
  aftertouch(aftertouch: number): T {
    return this.create({ ...this.shared, aftertouch })
  }

  /**
   * Apply this step to the bridge and emit note(s).
   *
   * Subclasses implement pitch resolution and emission logic.
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with note(s) emitted
   */
  abstract apply(bridge: CompositionBridge): CompositionBridge

  // === Apply Helpers ===

  /** @internal Creates a new builder instance preserving subclass-specific state. */
  protected abstract create(params: Partial<PitchStepParams>): T

  /**
   * Apply expression flags (precise, muted, detune, timbre, pressure, aftertouch)
   * onto the bridge before note emission.
   *
   * Subclasses call this at the start of `apply()`; flags are reset via {@link resetFlags}.
   *
   * @param bridge - Current composition state

   * @returns Bridge with flags applied
   */
  protected applyFlags(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    if (this.shared.precise) {
      target = target.withPrecise(true)
    }

    if (this.shared.muted) {
      target = target.withMuted(true)
    }

    if (this.shared.detune !== null) {
      target = target.withBend(this.shared.detune)
    }

    if (this.shared.timbre !== null) {
      target = target.withCC(MIDI_CC.BRIGHTNESS, this.shared.timbre)
    }

    if (this.shared.pressure !== null) {
      target = target.withCC(MIDI_CC.EFFECT_2, this.shared.pressure)
    }

    if (this.shared.aftertouch !== null) {
      target = target.withAftertouch(this.shared.aftertouch)
    }

    return target
  }

  /**
   * Reset flags (precise, muted) after note emission.
   *
   * Subclasses call this at the end of `apply()` to restore the bridge state.
   *
   * @param bridge - Bridge after note emission

   * @returns Bridge with flags reset
   */
  protected resetFlags(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    if (this.shared.precise) {
      target = target.withPrecise(false)
    }

    if (this.shared.muted) {
      target = target.withMuted(false)
    }

    return target
  }

  /**
   * Compute effective duration by applying durationScale to base duration.
   *
   * Returns `undefined` when `duration` is null (subclasses use bridge default).
   *
   * @returns Scaled duration in ticks, or undefined if no base duration set
   */
  protected resolvedDuration(): number | undefined {
    const baseDuration = this.shared.duration ?? undefined
    if (baseDuration === undefined) return undefined

    return Math.round(baseDuration * this.shared.durationScale)
  }
}
