/**
 * Western Standard notation implementation.
 *
 * Implements all abstract methods from BaseNotation for the
 * standard Western 12-tone equal temperament system.
 *
 * No regex. No imports from western-legacy/.
 */

import { BaseNotation, NotationInputError } from '@symphonyscript/core'
import type { Range, NotationCapabilities, ChordIntervals, KeySignature, ScaleIntervals } from '@symphonyscript/core'
import type { ChordResolution } from '@symphonyscript/core'

import {
  NOTE_TO_SEMITONE,
  SEMITONE_TO_NOTE_SHARP,
  SEMITONE_TO_NOTE_FLAT,
  INTERVAL_MAP,
  CENTS_TO_INTERVAL,
  DURATION_MAP,
  TICKS_RATIO_TO_DURATION,
  SCALE_MODE_MAP,
  SCALE_INTERVALS_MAP,
  KEY_SIGNATURE_TABLE,
  CHORD_INTERVALS_MAP,
  INTERVALS_TO_CHORD_MAP,
  ROMAN_TO_DEGREE,
} from './western.constants'

import { parseNoteString, parseRomanNumeral, parseChordCode } from './western.utils'

export class WesternNotation extends BaseNotation {

  // ==========================================================================
  // Identity & Config
  // ==========================================================================

  getId(): string { return 'western' }
  getName(): string { return 'Western Standard' }
  getTuningHz(): number { return 440 }
  /** Pitch range: 0 cents = C(-1), 13200 cents = C10. */
  getPitchRange(): Range { return { min: 0, max: 13200 } }
  prefersFlats(): boolean { return false }

  getCapabilities(): NotationCapabilities {
    return { chords: true, degrees: true, progressions: true }
  }

  /**
   * Override: A4 reference is 6900 cents in MIDI-aligned convention.
   * BaseNotation hardcodes 5700 (C0=0 convention).
   */
  override noteToFrequency(input: string): number {
    const cents = this.noteToCents(input)
    // A4 = 6900 cents in (octave+1)*1200 convention
    return this.getTuningHz() * Math.pow(2, (cents - 6900) / 1200)
  }

  // ==========================================================================
  // Notes
  // ==========================================================================

  noteToCents(input: string): number {
    const parsed = parseNoteString(input)
    if (parsed === null) {
      throw new NotationInputError(this.getId(), 'noteToCents', input)
    }

    const pitchName = parsed.letter + parsed.accidental
    const semitone = NOTE_TO_SEMITONE[pitchName]
    if (semitone === undefined) {
      throw new NotationInputError(this.getId(), 'noteToCents', input)
    }

    // (octave + 1) * 1200 aligns with MIDI: C(-1)=0 cents=MIDI 0, C4=6000=MIDI 60
    const cents = (parsed.octave + 1) * 1200 + semitone * 100
    const range = this.getPitchRange()
    if (cents < range.min || cents > range.max) {
      throw new NotationInputError(this.getId(), 'noteToCents', input)
    }

    return cents
  }

  centsToNote(cents: number): string {
    const range = this.getPitchRange()
    if (cents < range.min || cents > range.max) {
      throw new NotationInputError(this.getId(), 'centsToNote', String(cents))
    }

    // Reverse of (octave + 1) * 1200: octave = floor(cents/1200) - 1
    const octave = Math.floor(cents / 1200) - 1
    const remainder = ((cents % 1200) + 1200) % 1200
    const semitoneIndex = Math.round(remainder / 100) % 12

    const noteTable = this.prefersFlats() ? SEMITONE_TO_NOTE_FLAT : SEMITONE_TO_NOTE_SHARP
    return noteTable[semitoneIndex] + octave
  }

  // ==========================================================================
  // Intervals
  // ==========================================================================

  intervalToCents(input: string): number {
    const cents = INTERVAL_MAP[input]
    if (cents === undefined) {
      throw new NotationInputError(this.getId(), 'intervalToCents', input)
    }
    return cents
  }

  centsToInterval(cents: number): string {
    const normalized = ((cents % 1200) + 1200) % 1200
    const name = CENTS_TO_INTERVAL[normalized]
    if (name === undefined) {
      throw new NotationInputError(this.getId(), 'centsToInterval', String(cents))
    }
    return name
  }

  // ==========================================================================
  // Scales
  // ==========================================================================

  getScaleIntervals(mode: string): ScaleIntervals {
    const modeLower = mode.toLowerCase()
    const scaleMode = SCALE_MODE_MAP[modeLower]
    if (scaleMode === undefined) {
      throw new NotationInputError(this.getId(), 'getScaleIntervals', mode)
    }

    const intervals = SCALE_INTERVALS_MAP[scaleMode]
    if (intervals === undefined) {
      throw new NotationInputError(this.getId(), 'getScaleIntervals', mode)
    }

    return intervals
  }

  getSupportedScales(): string[] {
    return Object.keys(SCALE_MODE_MAP)
  }

  // ==========================================================================
  // Key Signatures
  // ==========================================================================

  getKeySignature(root: string, mode: string): KeySignature {
    const key = root + ':' + mode
    const sig = KEY_SIGNATURE_TABLE[key]
    if (sig === undefined) {
      throw new NotationInputError(this.getId(), 'getKeySignature', key)
    }
    return sig
  }

  // ==========================================================================
  // Degrees
  // ==========================================================================

  degreeToCents(input: string, scale: number[]): number {
    const parsed = parseRomanNumeral(input)
    if (parsed === null) {
      throw new NotationInputError(this.getId(), 'degreeToCents', input)
    }

    // Normalize to uppercase for degree lookup
    const degreeKey = parsed.degree.toUpperCase()
    const degreeIndex = ROMAN_TO_DEGREE[degreeKey]
    if (degreeIndex === undefined || degreeIndex >= scale.length) {
      throw new NotationInputError(this.getId(), 'degreeToCents', input)
    }

    let cents = scale[degreeIndex]

    // Apply accidentals
    if (parsed.accidental === 'b') cents -= 100
    else if (parsed.accidental === '#') cents += 100

    return cents
  }

  // ==========================================================================
  // Chords
  // ==========================================================================

  chordToIntervals(input: string): ChordIntervals {
    // First try as a bare suffix (e.g. 'maj7', 'm', '7')
    const directLookup = CHORD_INTERVALS_MAP.get(input)
    if (directLookup !== undefined) return directLookup

    // Parse as full chord code (e.g. 'Cmaj7' → root 'C', suffix 'maj7')
    const parsed = parseChordCode(input)
    if (parsed !== null) {
      const intervals = CHORD_INTERVALS_MAP.get(parsed.suffix)
      if (intervals !== undefined) return intervals
    }

    throw new NotationInputError(this.getId(), 'chordToIntervals', input)
  }

  intervalsToChord(intervals: ChordIntervals): string {
    const key = JSON.stringify(intervals)
    const suffix = INTERVALS_TO_CHORD_MAP.get(key)
    if (suffix === undefined) {
      throw new NotationInputError(this.getId(), 'intervalsToChord', key)
    }
    return suffix
  }

  getSupportedChords(): string[] {
    return Array.from(CHORD_INTERVALS_MAP.keys())
  }

  // ==========================================================================
  // Progressions
  // ==========================================================================

  resolveProgression(numerals: string[], scale: number[]): ChordResolution[] {
    const results: ChordResolution[] = []

    for (const numeral of numerals) {
      const parsed = parseRomanNumeral(numeral)
      if (parsed === null) {
        throw new NotationInputError(this.getId(), 'resolveProgression', numeral)
      }

      // --- Degree → root cents ---
      const degreeKey = parsed.degree.toUpperCase()
      const degreeIndex = ROMAN_TO_DEGREE[degreeKey]
      if (degreeIndex === undefined || degreeIndex >= scale.length) {
        throw new NotationInputError(this.getId(), 'resolveProgression', numeral)
      }

      let rootCents = scale[degreeIndex]
      if (parsed.accidental === 'b') rootCents -= 100
      else if (parsed.accidental === '#') rootCents += 100

      // --- Determine chord quality ---
      let quality = parsed.suffix

      if (parsed.isLowercase) {
        // Lowercase implies minor when no explicit minor/dim suffix
        if (!quality.startsWith('m') && !quality.startsWith('dim')) {
          if (quality === '') {
            quality = 'm'
          } else if (quality.length > 0 && quality[0] >= '0' && quality[0] <= '9') {
            // ii7 → m7, vi9 → m9
            quality = 'm' + quality
          }
        }
      }

      const intervals = CHORD_INTERVALS_MAP.get(quality)
      if (intervals === undefined) {
        throw new NotationInputError(this.getId(), 'resolveProgression', numeral)
      }

      results.push({ rootCents, intervals })
    }

    return results
  }

  // ==========================================================================
  // Rhythm
  // ==========================================================================

  durationToTicks(input: string, ppq: number): number {
    const multiplier = DURATION_MAP[input]
    if (multiplier === undefined) {
      throw new NotationInputError(this.getId(), 'durationToTicks', input)
    }
    return Math.round(multiplier * ppq)
  }

  ticksToDuration(ticks: number, ppq: number): string {
    const ratio = ticks / ppq

    let bestName = ''
    let bestDiff = Infinity

    for (const [multiplier, name] of TICKS_RATIO_TO_DURATION) {
      const diff = Math.abs(ratio - multiplier)
      if (diff < bestDiff) {
        bestDiff = diff
        bestName = name
      }
    }

    // Tolerance: within 1 tick
    const tolerance = 1 / ppq
    if (bestDiff > tolerance) {
      throw new NotationInputError(this.getId(), 'ticksToDuration', String(ticks))
    }

    return bestName
  }
}
