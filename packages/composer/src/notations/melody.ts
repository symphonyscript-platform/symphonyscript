import { CompositionBridge, PipeStep, step } from '@symphonyscript/composer'
import { NoteBuilder } from '../builders/NoteBuilder'
import { TrillBuilder } from '../builders/TrillBuilder'
import { TremoloBuilder } from '../builders/TremoloBuilder'
import { GlissandoBuilder } from '../builders/GlissandoBuilder'
import type { NotePitch } from '../types'
import { resolvePitch, resolvePitches } from '../utils/pitch'

/**
 * Binary step pattern.
 * 1 = play note (cycling through notes), 0 = rest.
 */
export function steps(
  pattern: number[],
  notes: NotePitch[],
  stepDuration?: number,
): PipeStep {
  return step((bridge) => {
    const duration = stepDuration ?? bridge.defaultDuration
    const pitches = resolvePitches(notes)
    let target = bridge
    let noteIndex = 0

    for (let i = 0; i < pattern.length; ++i) {
      if (pattern[i]) {
        target = target.withNote(
          pitches[noteIndex % pitches.length],
          duration,
        )
        noteIndex++
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  })
}

/**
 * Trill — rapid alternation between two pitches.
 */
export function trill(
  pitch: NotePitch,
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
  pitch: NotePitch,
  rate?: number,
  duration?: number,
): TremoloBuilder {
  return new TremoloBuilder({ pitch, rate, duration })
}

/**
 * Grace note — very short note immediately before the next main note.
 * Returns NoteBuilder for velocity/articulation configuration.
 */
export function grace(pitch: NotePitch, graceDuration: number = 30): NoteBuilder {
  const midi = resolvePitch(pitch)
  return new NoteBuilder({ pitch: midi, duration: graceDuration })
}

/**
 * Glissando — chromatic pitch slide from one note to another.
 */
export function glissando(
  from: NotePitch,
  to?: NotePitch,
  duration?: number,
): GlissandoBuilder {
  return new GlissandoBuilder({ from, to, duration })
}

/**
 * Tuplet — fit `count` notes into the time of `inBeats` beats.
 * The callback receives a bridge with adjusted default duration.
 */
export function tuplet(
  count: number,
  inBeats: number,
  stepsFn: (bridge: CompositionBridge) => CompositionBridge,
): PipeStep {
  return step((bridge) => {
    const totalDuration = inBeats * bridge.defaultDuration
    const tupletDuration = Math.round(totalDuration / count)
    const adjusted = bridge.withDefaultDuration(tupletDuration)

    return stepsFn(adjusted)
  })
}

/**
 * Polyrhythm — evenly space `noteCount` notes over `overBeats` beats.
 */
export function polyrhythm(
  noteCount: number,
  overBeats: number,
  stepsFn: (bridge: CompositionBridge) => CompositionBridge,
): PipeStep {
  return step((bridge) => {
    const totalDuration = overBeats * bridge.defaultDuration
    const noteDuration = Math.round(totalDuration / noteCount)
    const adjusted = bridge.withDefaultDuration(noteDuration)

    return stepsFn(adjusted)
  })
}
