import { noteToMidi } from '@symphonyscript/notations'
import type { NotePitch } from '../types'

/**
 * NotePitch: a pitch specified either as a literal note name string
 * ({@link LiteralNoteName}: `[A-G][#|b]?[octave]`, e.g. `'C4'`, `'F#3'`, `'Bb5'`)
 * or as a raw MIDI number (0–127). Strings are resolved via `noteToMidi`;
 * numbers pass through unchanged.
 */

/**
 * Resolve a {@link NotePitch} to a MIDI number.
 *
 * Numbers pass through unchanged. Strings are parsed via `noteToMidi` from
 * `@symphonyscript/theory`; invalid names or out-of-range results throw.
 *
 * @param input - Literal note name (e.g. `'C4'`, `'F#3'`, `'Bb5'`) or MIDI number (0–127)

 * @returns The MIDI number for the pitch
 * @throws `"Invalid note name: <input>"` when input is a string that cannot be parsed
 *   or yields a pitch outside MIDI range (0–127)
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
 * Resolve an array of {@link NotePitch} values to MIDI numbers.
 *
 * Maps each element through `resolvePitch`. Throws on the first invalid
 * string; does not validate MIDI range for numeric inputs.
 *
 * @param inputs - Array of literal note names or MIDI numbers

 * @returns Array of MIDI numbers in the same order
 * @throws `"Invalid note name: <input>"` when any element is a string that
 *   cannot be parsed or yields a pitch outside MIDI range (0–127)
 */
export function resolvePitches(inputs: NotePitch[]): number[] {
  const result: number[] = new Array(inputs.length)

  for (let i = 0; i < inputs.length; ++i) {
    result[i] = resolvePitch(inputs[i])
  }

  return result
}
