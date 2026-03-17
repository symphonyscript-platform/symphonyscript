/**
 * Hand-written parsers for Western notation strings.
 *
 * No regex. Each parser walks the string character by character.
 */

// ============================================================================
// Note String Parser
// ============================================================================

export interface ParsedNote {
  readonly letter: string
  readonly accidental: string
  readonly octave: number
}

/**
 * Parse a Western note string into letter, accidental, and octave.
 *
 * Accepts: `'C4'`, `'F#3'`, `'Bb5'`, `'D-1'`
 *
 * @returns Parsed components or `null` if invalid
 */
export function parseNoteString(input: string): ParsedNote | null {
  if (!input || typeof input !== 'string') return null

  let i = 0

  // 1. Letter (A-G, case-insensitive)
  const ch = input[i]
  if (ch === undefined) return null
  const letter = ch.toUpperCase()
  if (letter < 'A' || letter > 'G') return null
  i++

  // 2. Optional accidental (# or b)
  let accidental = ''
  if (i < input.length && (input[i] === '#' || input[i] === 'b')) {
    accidental = input[i]
    i++
  }

  // 3. Octave (digits, possibly negative)
  let sign = 1
  if (i < input.length && input[i] === '-') {
    sign = -1
    i++
  }

  if (i >= input.length || input[i] < '0' || input[i] > '9') return null

  let octave = 0
  while (i < input.length && input[i] >= '0' && input[i] <= '9') {
    octave = octave * 10 + Number(input[i])
    i++
  }

  // 4. Nothing remaining
  if (i !== input.length) return null

  return { letter, accidental, octave: sign * octave }
}

// ============================================================================
// Roman Numeral Parser
// ============================================================================

export interface ParsedRoman {
  /** Leading accidental: 'b', '#', or '' */
  readonly accidental: string
  /** Roman numeral stem, original case (e.g. 'IV', 'vi') */
  readonly degree: string
  /** Whether the stem is all-lowercase */
  readonly isLowercase: boolean
  /** Remaining suffix after the stem (e.g. '7', 'maj7', 'dim') */
  readonly suffix: string
}

/** Valid roman numeral stems in lowercase, ordered longest-first for greedy match. */
const ROMAN_STEMS = ['vii', 'iii', 'iv', 'vi', 'ii', 'v', 'i']

/**
 * Parse a roman numeral string into accidental, degree, case, and suffix.
 *
 * Accepts: `'I'`, `'V7'`, `'ii'`, `'bVII'`, `'#iv7'`, `'viidim7'`
 *
 * @returns Parsed components or `null` if invalid
 */
export function parseRomanNumeral(input: string): ParsedRoman | null {
  if (!input || typeof input !== 'string') return null

  let i = 0

  // 1. Optional leading accidental (b or #)
  let accidental = ''
  if (input[i] === 'b' || input[i] === '#') {
    accidental = input[i]
    i++
  }

  // 2. Roman numeral stem — greedy match (longest first)
  const remaining = input.slice(i)
  const remainingLower = remaining.toLowerCase()

  let matchedStem = ''
  for (const stem of ROMAN_STEMS) {
    if (remainingLower.startsWith(stem)) {
      matchedStem = remaining.slice(0, stem.length)
      i += stem.length
      break
    }
  }

  if (matchedStem === '') return null

  // 3. Determine case — is the original stem all lowercase?
  const isLowercase = matchedStem === matchedStem.toLowerCase()

  // 4. Remaining suffix
  const suffix = input.slice(i)

  return { accidental, degree: matchedStem, isLowercase, suffix }
}

// ============================================================================
// Chord Code Parser
// ============================================================================

export interface ParsedChordCode {
  /** Root note name (e.g. 'C', 'F#', 'Bb') */
  readonly root: string
  /** Chord quality suffix (e.g. 'maj7', 'm', '7', '') */
  readonly suffix: string
}

/**
 * Parse a chord code into root note and quality suffix.
 *
 * Accepts: `'Cmaj7'`, `'F#m'`, `'Bb7'`, `'D'`
 *
 * @returns Parsed components or `null` if invalid
 */
export function parseChordCode(input: string): ParsedChordCode | null {
  if (!input || typeof input !== 'string') return null

  let i = 0

  // 1. Root letter (A-G, case-insensitive)
  const ch = input[i]
  if (ch === undefined) return null
  const letter = ch.toUpperCase()
  if (letter < 'A' || letter > 'G') return null
  i++

  // 2. Optional accidental (# or b)
  let accidental = ''
  if (i < input.length && (input[i] === '#' || input[i] === 'b')) {
    accidental = input[i]
    i++
  }

  const root = letter + accidental

  // 3. Everything after is the suffix
  const suffix = input.slice(i)

  return { root, suffix }
}
