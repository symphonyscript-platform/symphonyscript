import { noteToMidi } from '@symphonyscript/theory'
import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'

export function note(input: NotePitch, duration?: number): NoteBuilder {
  let pitch: number

  if (typeof input === 'string') {
    const midi = noteToMidi(input)
    if (midi === null) {
      throw new Error(`Invalid note: ${input}`)
    }
    pitch = midi
  } else {
    pitch = input
  }

  return new NoteBuilder({ pitch, duration })
}
