/**
 * String-based scale mode resolution.
 *
 * Maps human-readable mode names (full and shorthand) to {@link ScaleMode} enum values.
 */


import { ScaleMode } from '@symphonyscript/core'

/**
 * Scale mode as a human-readable string. Supports full names and shorthands.
 */
export type ScaleModeName =
  | 'major' | 'maj'
  | 'minor' | 'min'
  | 'dorian' | 'dor'
  | 'phrygian' | 'phryg'
  | 'lydian' | 'lyd'
  | 'mixolydian' | 'mixo'
  | 'locrian' | 'loc'
  | 'harmonic minor' | 'harm min'
  | 'melodic minor' | 'mel min'
  | 'pentatonic major' | 'pent maj'
  | 'pentatonic minor' | 'pent min'
  | 'blues'
  | 'chromatic'
  | 'whole tone'
  | 'diminished hw' | 'dim hw'
  | 'diminished wh' | 'dim wh'
  | 'bebop dominant' | 'bebop dom'
  | 'bebop major' | 'bebop maj'
  | 'hirajoshi'
  | 'in sen'
  | 'hungarian minor' | 'hung min'
  | 'phrygian dominant' | 'phryg dom'

const MODE_NAME_MAP: Record<string, ScaleMode> = {
  'major':             ScaleMode.MAJOR,
  'maj':               ScaleMode.MAJOR,
  'minor':             ScaleMode.MINOR,
  'min':               ScaleMode.MINOR,
  'dorian':            ScaleMode.DORIAN,
  'dor':               ScaleMode.DORIAN,
  'phrygian':          ScaleMode.PHRYGIAN,
  'phryg':             ScaleMode.PHRYGIAN,
  'lydian':            ScaleMode.LYDIAN,
  'lyd':               ScaleMode.LYDIAN,
  'mixolydian':        ScaleMode.MIXOLYDIAN,
  'mixo':              ScaleMode.MIXOLYDIAN,
  'locrian':           ScaleMode.LOCRIAN,
  'loc':               ScaleMode.LOCRIAN,
  'harmonic minor':    ScaleMode.HARMONIC_MINOR,
  'harm min':          ScaleMode.HARMONIC_MINOR,
  'melodic minor':     ScaleMode.MELODIC_MINOR,
  'mel min':           ScaleMode.MELODIC_MINOR,
  'pentatonic major':  ScaleMode.PENTATONIC_MAJOR,
  'pent maj':          ScaleMode.PENTATONIC_MAJOR,
  'pentatonic minor':  ScaleMode.PENTATONIC_MINOR,
  'pent min':          ScaleMode.PENTATONIC_MINOR,
  'blues':             ScaleMode.BLUES,
  'chromatic':         ScaleMode.CHROMATIC,
  'whole tone':        ScaleMode.WHOLE_TONE,
  'diminished hw':     ScaleMode.DIMINISHED_HW,
  'dim hw':            ScaleMode.DIMINISHED_HW,
  'diminished wh':     ScaleMode.DIMINISHED_WH,
  'dim wh':            ScaleMode.DIMINISHED_WH,
  'bebop dominant':    ScaleMode.BEBOP_DOMINANT,
  'bebop dom':         ScaleMode.BEBOP_DOMINANT,
  'bebop major':       ScaleMode.BEBOP_MAJOR,
  'bebop maj':         ScaleMode.BEBOP_MAJOR,
  'hirajoshi':         ScaleMode.HIRAJOSHI,
  'in sen':            ScaleMode.IN_SEN,
  'hungarian minor':   ScaleMode.HUNGARIAN_MINOR,
  'hung min':          ScaleMode.HUNGARIAN_MINOR,
  'phrygian dominant': ScaleMode.PHRYGIAN_DOMINANT,
  'phryg dom':         ScaleMode.PHRYGIAN_DOMINANT,
}

/**
 * Resolve a scale mode from string name or {@link ScaleMode} enum.
 *
 * Enum values pass through unchanged. Strings are matched case-insensitively.
 *
 * @param input - Scale mode as string name, shorthand, or enum value
 * @returns Resolved {@link ScaleMode}
 * @throws If string is not a recognized scale mode name
 */
export function resolveScaleMode(input: ScaleModeName | ScaleMode): ScaleMode {
  if (typeof input === 'number') return input

  const mode = MODE_NAME_MAP[input.toLowerCase()]
  if (mode === undefined) {
    throw new Error(`Unknown scale mode: '${input}'`)
  }
  return mode
}
