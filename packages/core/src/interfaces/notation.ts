import { ChordIntervals, KeySignature, ScaleIntervals } from '../types'
import { Range } from './range'
import { NotationCapabilities } from './notation-capabilities'
import { ChordResolution } from './chord-resolution'

/**
 * Core interface for pluggable notation systems.
 *
 * A `Notation` maps between human-readable musical strings (note names,
 * chord symbols, interval names, durations) and the universal cents-based
 * pitch model used by the SymphonyScript engine.
 *
 * The built-in Western notation (`@symphonyscript/notations`) implements
 * this interface. Third-party packages can provide alternative notation
 * systems (Arabic maqam, Indian raga, Javanese gamelan, etc.) by
 * implementing this same interface.
 *
 * **Capability contract:**
 * Methods guarded by capabilities (`chords`, `degrees`, `progressions`)
 * must throw if the notation does not support that feature. Use
 * `getCapabilities()` to check support before calling.
 *
 * - Returning `null` means: "I support this operation, but the input is invalid."
 * - Throwing means: "This notation does not support this operation."
 *
 * **Abstract base class:**
 * Extend `BaseNotation` for default implementations of derived methods
 * (`noteToMidi`, `noteToFrequency`, `transposeNote`, `isEnharmonic`).
 */
export interface Notation {

  /* ---------- Identity ---------- */

  /**
   * Unique identifier for this notation system.
   * Used for serialization, debugging, and registry lookup.
   *
   * @returns Notation identifier (e.g., `'western'`, `'maqam-arabic'`, `'raga-hindustani'`)
   */
  getId(): string

  /**
   * Human-readable display name for this notation system.
   *
   * @returns Display name (e.g., `'Western Standard'`, `'Arabic Maqam'`)
   */
  getName(): string

  /* ---------- Configuration ---------- */

  /**
   * Default tuning reference frequency in Hz.
   * Western standard is 440 Hz (A4). Some traditions use 432 Hz or other values.
   * Can be overridden at runtime by the bridge or a `tuning()` cue.
   *
   * @returns Reference frequency in Hz for A4
   */
  getTuningHz(): number

  /**
   * Valid pitch range for this notation system, in cents from C0.
   * Notes outside this range may be rejected by `noteToCents()`.
   *
   * @returns Min/max cents range (e.g., `{ min: 0, max: 12000 }` for full audible range)
   */
  getPitchRange(): Range

  /**
   * Whether this notation prefers flat accidentals over sharps when formatting.
   * Affects `centsToNote()`, `centsToInterval()`, and other formatting methods.
   *
   * @returns `true` if flats are preferred (e.g., `'Bb'` over `'A#'`)
   */
  prefersFlats(): boolean

  /**
   * Declares which optional features this notation supports.
   * Methods guarded by a capability must throw if that capability is `false`.
   *
   * @returns Capability flags for chords, degrees, and progressions
   */
  getCapabilities(): NotationCapabilities

  /* ---------- Notes ---------- */

  /**
   * Parse a note string into cents from C0.
   *
   * @param input - Note string in this notation's format (e.g., `'C4'`, `'F#3'`, `'Bb5'`)
   * 
   * @returns Cents from C0 (e.g., `4800` for C4, `5700` for A4), or `null` if invalid
   */
  noteToCents(input: string): number | null

  /**
   * Format a cent value as a note string in this notation's format.
   *
   * @param cents - Pitch in cents from C0
   * 
   * @returns Note string (e.g., `'A4'` for `5700` cents)
   */
  centsToNote(cents: number): string

  /**
   * Convert a note string to a MIDI note number (0–127).
   * Derivable from `noteToCents()` via `Math.round(cents / 100)`.
   *
   * @param input - Note string in this notation's format
   * 
   * @returns MIDI note number (0–127), or `null` if invalid or out of MIDI range
   */
  noteToMidi(input: string): number | null

  /**
   * Convert a note string to a frequency in Hz.
   * Derivable from `noteToCents()` and `getTuningHz()`.
   *
   * @param input - Note string in this notation's format
   * 
   * @returns Frequency in Hz (e.g., `440` for A4 at standard tuning)
   * @throws If the input is not a valid note in this notation
   */
  noteToFrequency(input: string): number

  /**
   * Transpose a note by a given interval and return the result
   * formatted in this notation's string format.
   * Derivable from `noteToCents()` + `centsToNote()`.
   *
   * @param note - Note string to transpose
   * @param cents - Interval in cents (positive = up, negative = down)
   * 
   * @returns Transposed note string (e.g., `transposeNote('C4', 700)` → `'G4'`)
   * @throws If the input note is not valid in this notation
   */
  transposeNote(note: string, cents: number): string

  /**
   * Check whether two note strings represent the same pitch.
   * Derivable from comparing `noteToCents()` results.
   *
   * @param a - First note string
   * @param b - Second note string
   * 
   * @returns `true` if both notes resolve to the same cent value (e.g., `'C#4'` and `'Db4'`)
   */
  isEnharmonic(a: string, b: string): boolean

  /* ---------- Intervals ---------- */

  /**
   * Parse an interval name into cents.
   *
   * @param input - Interval name in this notation's format (e.g., `'P5'`, `'m3'`, `'tritone'`)
   * 
   * @returns Interval size in cents (e.g., `700` for a perfect fifth), or `null` if invalid
   */
  intervalToCents(input: string): number | null

  /**
   * Format a cent value as an interval name in this notation's format.
   *
   * @param cents - Interval size in cents
   * 
   * @returns Interval name (e.g., `'P5'` for `700` cents)
   */
  centsToInterval(cents: number): string

  /* ---------- Scales ---------- */

  /**
   * Get the interval structure for a named scale or mode.
   *
   * @param mode - Scale/mode name in this notation's vocabulary
   *               (e.g., `'major'`, `'minor'`, `'dorian'`, `'bayati'`, `'bhairav'`)
   * 
   * @returns Array of cent intervals from the root (e.g., `[0, 200, 400, 500, 700, 900, 1100]`
   *          for major scale), or `null` if the mode is not recognized
   */
  getScaleIntervals(mode: string): ScaleIntervals | null

  /**
   * List all scale/mode names supported by this notation.
   *
   * @returns Array of supported mode names
   */
  getSupportedScales(): string[]

  /* ---------- Key Signatures ---------- */

  /**
   * Get the key signature for a given root and mode.
   *
   * @param root - Root note name in this notation's format (e.g., `'D'`, `'Bb'`)
   * @param mode - Mode name (e.g., `'major'`, `'minor'`)
   * 
   * @returns Array of accidental strings (e.g., `['F#', 'C#']` for D major),
   *          or `null` if the key is not recognized
   */
  getKeySignature(root: string, mode: string): KeySignature | null

  /* ---------- Degrees ---------- */

  /**
   * Parse a degree notation string into cents from the scale root.
   * Throws if `capabilities.degrees` is `false`.
   *
   * @param input - Degree string in this notation's format
   *                (e.g., `'V'`, `'bVII'`, `'ii7'` for Western; sargam syllables for Indian)
   * @param scale - Scale interval array in cents (from `getScaleIntervals()`)
   * 
   * @returns Cents from the scale root for the degree, or `null` if the input is invalid
   * @throws If this notation does not support degree parsing
   */
  degreeToCents(input: string, scale: number[]): number | null

  /* ---------- Chords ---------- */

  /**
   * Parse a chord symbol into its interval structure.
   * Throws if `capabilities.chords` is `false`.
   *
   * @param input - Chord symbol (e.g., `'Cmaj7'`, `'F#m'`, `'Bb7'`)
   * 
   * @returns Chord intervals in cents from the root (e.g., `[0, 400, 700, 1100]`
   *          for maj7), or `null` if the chord symbol is not recognized
   * @throws If this notation does not support chord parsing
   */
  chordToIntervals(input: string): ChordIntervals | null

  /**
   * Format a chord interval structure as a chord symbol string.
   * Throws if `capabilities.chords` is `false`.
   *
   * @param intervals - Chord intervals in cents from the root
   * 
   * @returns Chord symbol string (e.g., `'maj7'`), or `null` if no matching symbol exists
   * @throws If this notation does not support chord formatting
   */
  intervalsToChord(intervals: ChordIntervals): string | null

  /**
   * List all chord symbols supported by this notation.
   * Throws if `capabilities.chords` is `false`.
   *
   * @returns Array of supported chord suffixes (e.g., `['', 'm', '7', 'maj7', 'dim', ...]`)
   * @throws If this notation does not support chords
   */
  getSupportedChords(): string[]

  /* ---------- Progressions ---------- */

  /**
   * Resolve an array of degree/numeral strings into chord resolutions.
   * Throws if `capabilities.progressions` is `false`.
   *
   * @param numerals - Array of degree strings (e.g., `['I', 'V', 'vi', 'IV']`)
   * @param scale - Scale interval array in cents
   * 
   * @returns Array of resolved chords with root cents and interval arrays
   * @throws If this notation does not support progression resolution
   */
  resolveProgression(numerals: string[], scale: number[]): ChordResolution[]

  /* ---------- Rhythm ---------- */

  /**
   * Parse a duration name into ticks.
   *
   * @param input - Duration name in this notation's format
   *                (e.g., `'quarter'`, `'half'`, `'eighth'`, `'whole'`)
   * @param ppq - Pulses per quarter note (tick resolution, e.g., `480`)
   * 
   * @returns Duration in ticks (e.g., `480` for a quarter note at PPQ 480),
   *          or `null` if the duration name is not recognized
   */
  durationToTicks(input: string, ppq: number): number | null

  /**
   * Format a tick count as a duration name in this notation's format.
   *
   * @param ticks - Duration in ticks
   * @param ppq - Pulses per quarter note
   * 
   * @returns Duration name (e.g., `'quarter'` for `480` ticks at PPQ 480)
   */
  ticksToDuration(ticks: number, ppq: number): string
}
