import { CompositionBridge, PipeStep, step } from '@symphonyscript/composer'
import { noteToMidi } from '@symphonyscript/theory'
import type { NotePitch } from '../types'

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

    // Resolve pitches
    const pitches: number[] = new Array(notes.length)
    for (let i = 0; i < notes.length; ++i) {
      const input = notes[i]
      if (typeof input === 'string') {
        const midi = noteToMidi(input)
        if (midi === null) throw new Error(`Invalid note in steps: ${input}`)
        pitches[i] = midi
      } else {
        pitches[i] = input
      }
    }

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
 * Trill between two pitches.
 * Rapidly alternates between the current bridge pitch context and the target.
 */
export function trill(
  pitch: NotePitch,
  basePitch: NotePitch,
  rate: number,
  duration: number,
): PipeStep {
  return step((bridge) => {
    const targetMidi = typeof pitch === 'string'
      ? noteToMidi(pitch) : pitch
    const baseMidi = typeof basePitch === 'string'
      ? noteToMidi(basePitch) : basePitch

    if (targetMidi === null || baseMidi === null) {
      throw new Error('Invalid pitch in trill')
    }

    const hitCount = Math.floor(duration / rate)
    let target = bridge

    for (let i = 0; i < hitCount; ++i) {
      const currentPitch = i % 2 === 0 ? baseMidi : targetMidi
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
    const midi = typeof pitch === 'string'
      ? noteToMidi(pitch) : pitch

    if (midi === null) throw new Error('Invalid pitch in tremolo')

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
 * Steals time from the next note (occupies a tiny duration).
 */
export function grace(pitch: NotePitch, graceDuration: number = 30): PipeStep {
  return step((bridge) => {
    const midi = typeof pitch === 'string'
      ? noteToMidi(pitch) : pitch

    if (midi === null) throw new Error('Invalid pitch in grace')

    return bridge.withNote(midi, graceDuration)
  })
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
    const fromMidi = typeof from === 'string'
      ? noteToMidi(from) : from
    const toMidi = typeof to === 'string'
      ? noteToMidi(to) : to

    if (fromMidi === null || toMidi === null) {
      throw new Error('Invalid pitch in glissando')
    }

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
