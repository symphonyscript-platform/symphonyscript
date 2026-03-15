import { NoteBuilder } from '../builders/NoteBuilder'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

export function note(input?: NotePitch, duration?: number): NoteBuilder {
  if (input === undefined) {
    return new NoteBuilder({ duration })
  }

  const pitch = resolvePitch(input)
  return new NoteBuilder({ pitch, duration })
}
