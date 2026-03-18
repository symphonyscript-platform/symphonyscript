import type { Temperament, TemperamentName } from './types'
import { Equal, Just, Pythagorean, Meantone } from './constants'

const PRESETS: Record<TemperamentName, Temperament> = {
  equal: Equal,
  just: Just,
  pythagorean: Pythagorean,
  meantone: Meantone,
}

/**
 * Resolve a temperament from a named preset or a custom cent array.
 *
 * @param input - Preset name or custom array of cent intervals (length >= 12)
 * @returns The resolved temperament
 */
export function resolveTemperament(input: TemperamentName | readonly number[]): Temperament {
  if (typeof input === 'string') {
    const preset = PRESETS[input]
    if (preset === undefined) {
      throw new Error(`Unknown temperament: '${input}'`)
    }
    return preset
  }
  if (input.length < 12) {
    throw new Error(`Temperament array must have at least 12 entries, got ${input.length}`)
  }
  return input
}
