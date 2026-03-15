import { pack } from '@symphonyscript/theory'
import type { HarmonyMask, Interval24EDO } from '@symphonyscript/theory'

/**
 * Chord quality definitions: suffix → 12-TET semitone intervals.
 */
const CHORD_MAP: Readonly<Record<string, readonly number[]>> = {
  // Triads
  '': [0, 4, 7],
  'maj': [0, 4, 7],
  'm': [0, 3, 7],
  'min': [0, 3, 7],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],

  // 7ths
  'maj7': [0, 4, 7, 11],
  'm7': [0, 3, 7, 10],
  'min7': [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'dim7': [0, 3, 6, 9],
  'm7b5': [0, 3, 6, 10],

  // Suspensions
  'sus4': [0, 5, 7],
  'sus2': [0, 2, 7],
}

/**
 * Note letter → semitone offset from C.
 * A=9, B=11, C=0, D=2, E=4, F=5, G=7
 */
const NOTE_OFFSETS = [9, 11, 0, 2, 4, 5, 7] // charCode 65 (A) through 71 (G)

export interface ParsedChord {
  root: number       // MIDI pitch (C4-based, e.g., C=60, G=67)
  mask: HarmonyMask  // 24-EDO packed bitmask
}

/**
 * Parse a chord symbol into root MIDI pitch and 24-EDO HarmonyMask.
 *
 * Supports: root note (A-G), accidentals (#, b), and chord qualities
 * (maj, m/min, dim, aug, maj7, m7/min7, 7, dim7, m7b5, sus2, sus4).
 *
 * @param symbol - Chord symbol (e.g., 'Cmaj7', 'Am', 'F#dim')
 * @returns Parsed root pitch and HarmonyMask
 */
export function parseChord(symbol: string): ParsedChord {
  if (symbol.length === 0) {
    throw new Error('Empty chord symbol')
  }

  // Parse root note letter [A-G]
  const noteChar = symbol.charCodeAt(0)
  if (noteChar < 65 || noteChar > 71) {
    throw new Error(`Invalid chord root note: ${symbol}`)
  }

  let index = 1
  const noteBase = NOTE_OFFSETS[noteChar - 65]

  // Parse optional accidental
  let accidental = 0
  if (index < symbol.length) {
    const accChar = symbol.charCodeAt(index)
    if (accChar === 35) { // '#'
      accidental = 1
      index++
    } else if (accChar === 98) { // 'b'
      accidental = -1
      index++
    }
  }

  const pitchClass = (noteBase + accidental + 12) % 12
  const root = 60 + pitchClass

  // Parse chord quality suffix
  const suffix = symbol.slice(index)
  const intervals = CHORD_MAP[suffix]

  if (!intervals) {
    throw new Error(`Unknown chord quality: "${suffix}"`)
  }

  // Convert 12-TET intervals to 24-EDO and pack into HarmonyMask
  const intervals24: Interval24EDO[] = new Array(intervals.length)
  for (let i = 0; i < intervals.length; ++i) {
    intervals24[i] = (intervals[i] * 2) as Interval24EDO
  }

  return { root, mask: pack(intervals24) }
}
