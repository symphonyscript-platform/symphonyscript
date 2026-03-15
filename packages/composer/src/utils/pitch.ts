import { noteToMidi } from '@symphonyscript/theory'
import type { NotePitch } from '../types'

/**
 * Resolve a NotePitch to a MIDI number.
 * Accepts either a literal note name ('C4', 'F#3') or a raw MIDI number.
 *
 * @throws If the string cannot be parsed as a valid note name.
 */
export function resolvePitch(input: NotePitch): number {
  if (typeof input === 'number') return input

  const midi = noteToMidi(input)
  if (midi === null) {
    throw new Error(`Invalid note name: ${input}`)
  }
  return midi
}

/**
 * Resolve an array of NotePitch values to MIDI numbers.
 *
 * @throws If any string cannot be parsed as a valid note name.
 */
export function resolvePitches(inputs: NotePitch[]): number[] {
  const result: number[] = new Array(inputs.length)
  for (let i = 0; i < inputs.length; ++i) {
    result[i] = resolvePitch(inputs[i])
  }
  return result
}
