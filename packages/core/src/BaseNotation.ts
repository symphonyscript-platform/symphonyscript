import { Notation } from './interfaces/notation'
import { Range } from './interfaces/range'
import { NotationCapabilities } from './interfaces/notation-capabilities'
import { ChordIntervals, KeySignature, ScaleIntervals } from './types'
import { ScaleMode, PitchClass } from './registries'
import { ChordResolution } from './interfaces/chord-resolution'
import { NotationInputError } from './errors'

/**
 * Abstract base class for notation implementations.
 *
 * Provides default implementations for derived methods that can be
 * computed from the abstract methods. Subclasses implement the
 * notation-specific abstract methods; derived methods come for free.
 *
 * Derived methods (override if your notation needs custom behavior):
 * - `noteToMidi()` — from `noteToCents()`
 * - `noteToFrequency()` — from `noteToCents()` + `getTuningHz()`
 * - `transposeNote()` — from `noteToCents()` + `centsToNote()`
 * - `isEnharmonic()` — from `noteToCents()`
 */
export abstract class BaseNotation implements Notation {
  /**
   * Convert a note string to MIDI (0–127).
   * Default: `Math.round(noteToCents(input) / 100)`.
   *
   * @throws {NotationInputError} If the input is invalid or out of MIDI range
   */
  noteToMidi(input: string): number {
    const cents = this.noteToCents(input)
    const midi = Math.round(cents / 100)

    if (midi < 0 || midi > 127) {
      throw new NotationInputError(this.getId(), 'noteToMidi', input)
    }

    return midi
  }

  /**
   * Convert a note string to frequency in Hz.
   * Default: `tuningHz × 2^((cents − 5700) / 1200)`.
   *
   * @throws {NotationInputError} If the input is not a valid note
   */
  noteToFrequency(input: string): number {
    const cents = this.noteToCents(input)
    // A4 = 5700 cents from C0
    return this.getTuningHz() * Math.pow(2, (cents - 5700) / 1200)
  }

  /**
   * Transpose a note and re-format.
   * Default: `centsToNote(noteToCents(note) + cents)`.
   *
   * @throws {NotationInputError} If the input note is not valid
   */
  transposeNote(note: string, cents: number): string {
    const noteCents = this.noteToCents(note)
    return this.centsToNote(noteCents + cents)
  }

  /**
   * Check enharmonic equivalence.
   * Default: `noteToCents(a) === noteToCents(b)`.
   *
   * @throws {NotationInputError} If either input is not a valid note
   */
  isEnharmonic(a: string, b: string): boolean {
    return this.noteToCents(a) === this.noteToCents(b)
  }

  /* ---------- Abstract methods ---------- */

  abstract getId(): string
  abstract getName(): string

  abstract getTuningHz(): number
  abstract getPitchRange(): Range
  abstract prefersFlats(): boolean
  abstract getCapabilities(): NotationCapabilities

  abstract noteToCents(input: string): number
  abstract centsToNote(cents: number): string

  abstract intervalToCents(input: string): number
  abstract centsToInterval(cents: number): string

  abstract getScaleIntervals(mode: ScaleMode): ScaleIntervals
  abstract getSupportedScales(): ScaleMode[]

  abstract getKeySignature(root: PitchClass, mode: ScaleMode): KeySignature

  abstract degreeToCents(input: string, scale: number[]): number

  abstract chordToIntervals(input: string): ChordIntervals
  abstract intervalsToChord(intervals: ChordIntervals): string
  abstract getSupportedChords(): string[]

  abstract resolveProgression(numerals: string[], scale: number[]): ChordResolution[]

  abstract durationToTicks(input: string, ppq: number): number
  abstract ticksToDuration(ticks: number, ppq: number): string
}
