import { Notation } from './interfaces/notation'
import { Range } from './interfaces/range'
import { NotationCapabilities } from './interfaces/notation-capabilities'
import { ChordIntervals, KeySignature, ScaleIntervals } from './types'
import { ChordResolution } from './interfaces/chord-resolution'

/**
 * Abstract base class for notation implementations.
 *
 * Provides default implementations for derived methods that can be
 * computed from the abstract methods.
 */
export abstract class BaseNotation implements Notation {
  /**
   * Convert a note string to MIDI (0–127).
   */
  noteToMidi(input: string): number | null {
    const cents = this.noteToCents(input)
    if (cents === null) return null
    const midi = Math.round(cents / 100)

    return (midi >= 0 && midi <= 127) ? midi : null
  }

  /**
   * Convert a note string to frequency in Hz.
   *
   * @throws If the input is not a valid note
   */
  noteToFrequency(input: string): number {
    const cents = this.noteToCents(input)
    if (cents === null) {
      throw new Error(`Invalid note: '${input}' is not recognized by ${this.getId()} notation`)
    }

    return this.getTuningHz() * Math.pow(2, (cents - 5700) / 1200)
  }

  /**
   * Transpose a note and re-format.
   *
   * @throws If the input note is not valid
   */
  transposeNote(note: string, cents: number): string {
    const noteCents = this.noteToCents(note)

    if (noteCents === null) {
      throw new Error(`Invalid note: '${note}' is not recognized by ${this.getId()} notation`)
    }

    return this.centsToNote(noteCents + cents)
  }

  /**
   * Check enharmonic equivalence.
   */
  isEnharmonic(a: string, b: string): boolean {
    const ca = this.noteToCents(a)
    const cb = this.noteToCents(b)
    if (ca === null || cb === null) return false

    return ca === cb
  }

  abstract getId(): string
  abstract getName(): string

  abstract getTuningHz(): number
  abstract getPitchRange(): Range
  abstract prefersFlats(): boolean
  abstract getCapabilities(): NotationCapabilities

  abstract noteToCents(input: string): number | null
  abstract centsToNote(cents: number): string

  abstract intervalToCents(input: string): number | null
  abstract centsToInterval(cents: number): string

  abstract getScaleIntervals(mode: string): ScaleIntervals | null
  abstract getSupportedScales(): string[]

  abstract getKeySignature(root: string, mode: string): KeySignature | null

  abstract degreeToCents(input: string, scale: number[]): number | null

  abstract chordToIntervals(input: string): ChordIntervals | null
  abstract intervalsToChord(intervals: ChordIntervals): string | null
  abstract getSupportedChords(): string[]

  abstract resolveProgression(numerals: string[], scale: number[]): ChordResolution[]

  abstract durationToTicks(input: string, ppq: number): number | null
  abstract ticksToDuration(ticks: number, ppq: number): string
}
