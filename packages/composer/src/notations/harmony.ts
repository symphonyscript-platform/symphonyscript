import { noteToMidi } from '@symphonyscript/theory'
import { HarmonyBuilder } from '../builders/HarmonyBuilder'
import type { HarmonyMask } from '@symphonyscript/theory'
import type { NotePitch } from '../types'

export function harmony(
  mask: HarmonyMask,
  root: NotePitch,
  duration?: number,
): HarmonyBuilder {
  let rootPitch: number

  if (typeof root === 'string') {
    const midi = noteToMidi(root)
    if (midi === null) {
      throw new Error(`Invalid root note: ${root}`)
    }
    rootPitch = midi
  } else {
    rootPitch = root
  }

  return new HarmonyBuilder({ mask, root: rootPitch, duration })
}
