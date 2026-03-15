import { HarmonyBuilder } from '../builders/HarmonyBuilder'
import { parseChord } from '../utils/chord'
import type { HarmonyMask } from '@symphonyscript/theory'

/**
 * Parse a chord symbol and return a HarmonyBuilder.
 *
 * @param symbol - Chord symbol (e.g., 'Cmaj7', 'Am', 'F#dim')
 * @param duration - Optional duration for all notes
 */
export function chord(symbol?: string, duration?: number): HarmonyBuilder {
  if (symbol === undefined) {
    return new HarmonyBuilder({ mask: 0 as HarmonyMask, duration })
  }

  const parsed = parseChord(symbol)

  return new HarmonyBuilder({
    mask: parsed.mask,
    root: parsed.root,
    duration,
  })
}
