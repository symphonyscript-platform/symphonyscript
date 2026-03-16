import { StepsBuilder } from '../builders/StepsBuilder'
import { TrillBuilder } from '../builders/TrillBuilder'
import { TremoloBuilder } from '../builders/TremoloBuilder'
import { GlissandoBuilder } from '../builders/GlissandoBuilder'
import { TupletBuilder } from '../builders/TupletBuilder'
import { PolyrhythmBuilder } from '../builders/PolyrhythmBuilder'
import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Binary step pattern. 1 = play note (cycling through notes), 0 = rest.
 *
 * Cycles through the notes array on each `1`; advances tick on `0` without emitting.
 *
 * @param pattern - Array of 1s and 0s.
 * @param notes - Pitches to cycle on hits. String (e.g. `'C4'`) or MIDI; resolved via {@link resolvePitch}.
 * @param stepDuration - Duration per step in ticks. `undefined` = bridge default.

 * @returns {@link StepsBuilder}
 *
 * @example
 * ```ts
 * steps([1, 0, 1, 0], ['C4', 'E4'])       // Alternating C4/E4 on backbeat
 * steps([1, 1, 1, 1], ['C4'], 120)       // Four C4s, 120 ticks each
 * ```
 */
export function steps(
  pattern?: number[],
  notes?: NotePitch[],
  stepDuration?: NoteDuration,
): StepsBuilder {
  const resolvedDuration = stepDuration !== undefined ? resolveDuration(stepDuration) : undefined
  return new StepsBuilder({ pattern, notes, stepDuration: resolvedDuration })
}

/**
 * Trill — rapid alternation between two pitches.
 *
 * @param pitch - Upper pitch. String or MIDI; resolved via {@link resolvePitch}.
 * @param basePitch - Lower pitch. Omit for semitone below.
 * @param rate - Alternation rate (e.g. notes per beat).
 * @param duration - Total trill duration in ticks.

 * @returns {@link TrillBuilder}
 *
 * @example
 * ```ts
 * trill('E4', 'D4')           // E4–D4 trill
 * trill('C5', undefined, 8)   // C5–B4 trill, rate 8
 * ```
 */
export function trill(
  pitch?: NotePitch,
  basePitch?: NotePitch,
  rate?: number,
  duration?: NoteDuration,
): TrillBuilder {
  const resolvedDuration = resolveDuration(duration)
  return new TrillBuilder({ pitch, basePitch, rate, duration: resolvedDuration })
}

/**
 * Tremolo — rapid repeated single note.
 *
 * @param pitch - Note to repeat. String or MIDI; resolved via {@link resolvePitch}.
 * @param rate - Repetition rate.
 * @param duration - Total tremolo duration in ticks.

 * @returns {@link TremoloBuilder}
 *
 * @example
 * ```ts
 * tremolo('C4', 16, 480)      // C4 tremolo, half note
 * tremolo(60, 8, 240)         // MIDI 60 tremolo
 * ```
 */
export function tremolo(
  pitch?: NotePitch,
  rate?: number,
  duration?: NoteDuration,
): TremoloBuilder {
  const resolvedDuration = resolveDuration(duration)
  return new TremoloBuilder({ pitch, rate, duration: resolvedDuration })
}

/**
 * Grace note — very short note immediately before the next main note.
 *
 * Returns {@link NoteBuilder} for velocity/articulation configuration. Use inside
 * a sequence; the grace note is emitted just before the following note.
 *
 * @param pitch - Pitch for the grace note. Omit for C4.
 * @param graceDuration - Grace note duration in ticks. Default 30.

 * @returns {@link NoteBuilder} with fixed short duration.
 *
 * @example
 * ```ts
 * grace('E4').then(note('C4'))   // E4 grace before C4
 * grace(64, 20)                  // MIDI 64, 20-tick grace
 * ```
 */
export function grace(pitch?: NotePitch, graceDuration: NoteDuration = 30): NoteBuilder {
  const resolvedDuration = resolveDuration(graceDuration)
  if (pitch === undefined) {
    return new NoteBuilder({ duration: resolvedDuration })
  }
  const midi = resolvePitch(pitch)
  return new NoteBuilder({ pitch: midi, duration: resolvedDuration })
}

/**
 * Glissando — chromatic pitch slide from one note to another.
 *
 * @param from - Starting pitch. String or MIDI; resolved via {@link resolvePitch}.
 * @param to - Ending pitch. String or MIDI; resolved via {@link resolvePitch}.
 * @param duration - Slide duration in ticks.

 * @returns {@link GlissandoBuilder}
 *
 * @example
 * ```ts
 * glissando('C4', 'C5', 480)   // Chromatic slide up an octave
 * glissando(60, 72, 240)       // MIDI 60 → 72
 * ```
 */
export function glissando(
  from?: NotePitch,
  to?: NotePitch,
  duration?: NoteDuration,
): GlissandoBuilder {
  const resolvedDuration = resolveDuration(duration)
  return new GlissandoBuilder({ from, to, duration: resolvedDuration })
}

/**
 * Tuplet — fit `count` notes into the time of `inBeats` beats.
 *
 * Wraps inner steps so that `count` evenly spaced notes occupy `inBeats` beat durations.
 *
 * @param count - Number of notes in the tuplet.
 * @param inBeats - Number of beats the tuplet occupies.

 * @returns {@link TupletBuilder} — call `.steps()` to add the tuplet notes.
 *
 * @example
 * ```ts
 * tuplet(3, 2).steps(note('C4'), note('E4'), note('G4'))  // Triplet in 2 beats
 * tuplet(5, 4).steps(...)                                // Quintuplet
 * ```
 */
export function tuplet(
  count?: number,
  inBeats?: number,
): TupletBuilder {
  return new TupletBuilder({ noteCount: count, overBeats: inBeats })
}

/**
 * Polyrhythm — evenly space `noteCount` notes over `overBeats` beats.
 *
 * Distributes notes across the time span; use `.steps()` to provide the notes.
 *
 * @param noteCount - Number of notes to distribute.
 * @param overBeats - Number of beats to span.

 * @returns {@link PolyrhythmBuilder} — call `.steps()` to add the notes.
 *
 * @example
 * ```ts
 * polyrhythm(3, 2).steps(note('C4'), note('E4'), note('G4'))  // 3 over 2
 * polyrhythm(5, 4).steps(...)                                 // 5 over 4
 * ```
 */
export function polyrhythm(
  noteCount?: number,
  overBeats?: number,
): PolyrhythmBuilder {
  return new PolyrhythmBuilder({ noteCount, overBeats })
}
