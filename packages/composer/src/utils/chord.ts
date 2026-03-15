import type { HarmonyMask, Interval24EDO } from '@symphonyscript/theory'
import { pack } from '@symphonyscript/theory'

/**
 * Chord quality lookup: suffix string → 12-TET semitone intervals from root.
 *
 * Supports triads, 7ths, and suspensions. Order within each array defines
 * the interval stack (root is always 0).
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
 * Note letter → semitone offset from C, indexed by `charCode - 65`.
 *
 * | Letter | Code | Offset |
 * |--------|------|--------|
 * | A      | 65   | 9      |
 * | B      | 66   | 11     |
 * | C      | 67   | 0      |
 * | D      | 68   | 2      |
 * | E      | 69   | 4      |
 * | F      | 70   | 5      |
 * | G      | 71   | 7      |
 */
const NOTE_OFFSETS = [9, 11, 0, 2, 4, 5, 7]

/**
 * Result of parsing a chord symbol.
 */
export interface ParsedChord {
  /** Root MIDI pitch in octave 4 (C4=60, C#4=61, ... B4=71). */
  root: number
  /** 24-EDO packed interval bitmask for use with `@symphonyscript/theory`. */
  mask: HarmonyMask
}

/**
 * Parse a chord symbol string into a root MIDI pitch and 24-EDO HarmonyMask.
 *
 * **Format:** `[A-G][#|b]?[quality]`
 *
 * **Parsing steps:**
 * 1. Extract root note letter (A-G) → semitone offset via {@link NOTE_OFFSETS}
 * 2. Apply optional accidental (`#` = +1, `b` = -1)
 * 3. Compute root MIDI pitch = 60 + pitchClass
 * 4. Match remaining suffix against {@link CHORD_MAP}
 * 5. Convert 12-TET intervals to 24-EDO and pack into HarmonyMask
 *
 * @param symbol - Chord symbol (e.g. `'Cmaj7'`, `'Am'`, `'F#dim'`, `'Bbsus4'`)
 * @returns Parsed root pitch and interval mask
 * @throws `"Empty chord symbol"` if `symbol` is empty
 * @throws `"Invalid chord root note"` if first character is not A-G
 * @throws `"Unknown chord quality"` if suffix is not in CHORD_MAP
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
