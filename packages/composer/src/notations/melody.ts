import { StepsBuilder } from '../builders/StepsBuilder'
import { TrillBuilder } from '../builders/TrillBuilder'
import { TremoloBuilder } from '../builders/TremoloBuilder'
import { GlissandoBuilder } from '../builders/GlissandoBuilder'
import { TupletBuilder } from '../builders/TupletBuilder'
import { PolyrhythmBuilder } from '../builders/PolyrhythmBuilder'
import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

/**
 * Binary step pattern.
 * 1 = play note (cycling through notes), 0 = rest.
 */
export function steps(
  pattern?: number[],
  notes?: NotePitch[],
  stepDuration?: number,
): StepsBuilder {
  return new StepsBuilder({ pattern, notes, stepDuration })
}

/**
 * Trill — rapid alternation between two pitches.
 */
export function trill(
  pitch?: NotePitch,
  basePitch?: NotePitch,
  rate?: number,
  duration?: number,
): TrillBuilder {
  return new TrillBuilder({ pitch, basePitch, rate, duration })
}

/**
 * Tremolo — rapid repeated note.
 */
export function tremolo(
  pitch?: NotePitch,
  rate?: number,
  duration?: number,
): TremoloBuilder {
  return new TremoloBuilder({ pitch, rate, duration })
}

/**
 * Grace note — very short note immediately before the next main note.
 * Returns NoteBuilder for velocity/articulation configuration.
 */
export function grace(pitch?: NotePitch, graceDuration: number = 30): NoteBuilder {
  if (pitch === undefined) {
    return new NoteBuilder({ duration: graceDuration })
  }
  const midi = resolvePitch(pitch)
  return new NoteBuilder({ pitch: midi, duration: graceDuration })
}

/**
 * Glissando — chromatic pitch slide from one note to another.
 */
export function glissando(
  from?: NotePitch,
  to?: NotePitch,
  duration?: number,
): GlissandoBuilder {
  return new GlissandoBuilder({ from, to, duration })
}

/**
 * Tuplet — fit `count` notes into the time of `inBeats` beats.
 */
export function tuplet(
  count?: number,
  inBeats?: number,
): TupletBuilder {
  return new TupletBuilder({ noteCount: count, overBeats: inBeats })
}

/**
 * Polyrhythm — evenly space `noteCount` notes over `overBeats` beats.
 */
export function polyrhythm(
  noteCount?: number,
  overBeats?: number,
): PolyrhythmBuilder {
  return new PolyrhythmBuilder({ noteCount, overBeats })
}
