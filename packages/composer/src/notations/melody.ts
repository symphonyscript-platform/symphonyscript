import { CompositionBridge, PipeStep, step } from '@symphonyscript/composer'
import { NoteBuilder } from '../builders/NoteBuilder'
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
 * Trill — rapid alternation between two adjacent pitches.
 * Alternates between the given pitch and a pitch one step above.
 */
export function trill(
  pitch: NotePitch,
  rate: number,
  duration: number,
): PipeStep {
  return step((bridge) => {
    const baseMidi = resolvePitch(pitch)
    const trillMidi = baseMidi + 1 // semitone above

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      const currentPitch = i % 2 === 0 ? baseMidi : trillMidi
      target = target.withNote(currentPitch, rate)
    }

    return target
  })
}

/**
 * Tremolo — rapid repeated note.
 */
export function tremolo(
  pitch: NotePitch,
  rate: number,
  duration: number,
): PipeStep {
  return step((bridge) => {
    const midi = resolvePitch(pitch)
    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      target = target.withNote(midi, rate)
    }

    return target
  })
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
 * Emits a series of chromatic notes (semitone steps) over the duration.
 */
export function glissando(
  from: NotePitch,
  to: NotePitch,
  duration: number,
): PipeStep {
  return step((bridge) => {
    const fromMidi = resolvePitch(from)
    const toMidi = resolvePitch(to)
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
  })
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
