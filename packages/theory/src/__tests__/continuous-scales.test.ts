/**
 * Tests for RFC-060: Cent-Based Scale Definitions.
 *
 * Updated to use individually exported scale interval constants
 * instead of the removed SCALE_INTERVALS map.
 */

import { Interval } from '../continuous/intervals'
import {
  IONIAN_INTERVALS,
  DORIAN_INTERVALS,
  PHRYGIAN_INTERVALS,
  LYDIAN_INTERVALS,
  MIXOLYDIAN_INTERVALS,
  AEOLIAN_INTERVALS,
  LOCRIAN_INTERVALS,
  HARMONIC_MINOR_INTERVALS,
  MELODIC_MINOR_INTERVALS,
  PENTATONIC_MAJOR_INTERVALS,
  PENTATONIC_MINOR_INTERVALS,
  BLUES_INTERVALS,
  CHROMATIC_INTERVALS,
  WHOLE_TONE_INTERVALS,
  DIMINISHED_HW_INTERVALS,
  DIMINISHED_WH_INTERVALS,
  BEBOP_DOMINANT_INTERVALS,
  BEBOP_MAJOR_INTERVALS,
  HIRAJOSHI_INTERVALS,
  IN_SEN_INTERVALS,
  HUNGARIAN_MINOR_INTERVALS,
  PHRYGIAN_DOMINANT_INTERVALS,
  degreeToCents,
} from '../continuous/scales'

describe('RFC-060: Cent-Based Scale Definitions', () => {
  // ========================================================================
  // Scale Interval Constants
  // ========================================================================

  describe('Scale interval constants', () => {
    // Expected sizes for each scale
    const scaleSizes: [string, readonly number[]][] = [
      ['IONIAN', IONIAN_INTERVALS],
      ['DORIAN', DORIAN_INTERVALS],
      ['PHRYGIAN', PHRYGIAN_INTERVALS],
      ['LYDIAN', LYDIAN_INTERVALS],
      ['MIXOLYDIAN', MIXOLYDIAN_INTERVALS],
      ['AEOLIAN', AEOLIAN_INTERVALS],
      ['LOCRIAN', LOCRIAN_INTERVALS],
      ['HARMONIC_MINOR', HARMONIC_MINOR_INTERVALS],
      ['MELODIC_MINOR', MELODIC_MINOR_INTERVALS],
      ['PENTATONIC_MAJOR', PENTATONIC_MAJOR_INTERVALS],
      ['PENTATONIC_MINOR', PENTATONIC_MINOR_INTERVALS],
      ['BLUES', BLUES_INTERVALS],
      ['CHROMATIC', CHROMATIC_INTERVALS],
      ['WHOLE_TONE', WHOLE_TONE_INTERVALS],
      ['DIMINISHED_HW', DIMINISHED_HW_INTERVALS],
      ['DIMINISHED_WH', DIMINISHED_WH_INTERVALS],
      ['BEBOP_DOMINANT', BEBOP_DOMINANT_INTERVALS],
      ['BEBOP_MAJOR', BEBOP_MAJOR_INTERVALS],
      ['HIRAJOSHI', HIRAJOSHI_INTERVALS],
      ['IN_SEN', IN_SEN_INTERVALS],
      ['HUNGARIAN_MINOR', HUNGARIAN_MINOR_INTERVALS],
      ['PHRYGIAN_DOMINANT', PHRYGIAN_DOMINANT_INTERVALS],
    ]

    const expectedSizes: Record<string, number> = {
      IONIAN: 7, DORIAN: 7, PHRYGIAN: 7, LYDIAN: 7, MIXOLYDIAN: 7,
      AEOLIAN: 7, LOCRIAN: 7, HARMONIC_MINOR: 7, MELODIC_MINOR: 7,
      PENTATONIC_MAJOR: 5, PENTATONIC_MINOR: 5, BLUES: 6,
      CHROMATIC: 12, WHOLE_TONE: 6,
      DIMINISHED_HW: 8, DIMINISHED_WH: 8,
      BEBOP_DOMINANT: 8, BEBOP_MAJOR: 8,
      HIRAJOSHI: 5, IN_SEN: 5, HUNGARIAN_MINOR: 7, PHRYGIAN_DOMINANT: 7,
    }

    for (const [name, intervals] of scaleSizes) {
      it(`${name} has ${expectedSizes[name]} degrees`, () => {
        expect(intervals).toHaveLength(expectedSizes[name])
      })
    }

    // Structural invariants for all scales
    for (const [name, intervals] of scaleSizes) {
      it(`${name} starts with 0 (unison)`, () => {
        expect(intervals[0]).toBe(0)
      })

      it(`${name} has all entries < 1200`, () => {
        for (const cent of intervals) {
          expect(cent).toBeLessThan(1200)
        }
      })

      it(`${name} is sorted ascending`, () => {
        for (let i = 1; i < intervals.length; i++) {
          expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
        }
      })
    }

    // Specific scale content checks
    it('IONIAN (major) has correct intervals: 0-200-400-500-700-900-1100', () => {
      expect(IONIAN_INTERVALS).toEqual([0, 200, 400, 500, 700, 900, 1100])
    })

    it('AEOLIAN (minor) has correct intervals: 0-200-300-500-700-800-1000', () => {
      expect(AEOLIAN_INTERVALS).toEqual([0, 200, 300, 500, 700, 800, 1000])
    })

    it('CHROMATIC has 12 entries spaced 100 cents apart', () => {
      for (let i = 0; i < 12; i++) {
        expect(CHROMATIC_INTERVALS[i]).toBe(i * 100)
      }
    })

    it('WHOLE_TONE has 6 entries spaced 200 cents apart', () => {
      for (let i = 0; i < 6; i++) {
        expect(WHOLE_TONE_INTERVALS[i]).toBe(i * 200)
      }
    })

    it('PENTATONIC_MAJOR is a subset of IONIAN', () => {
      for (const cent of PENTATONIC_MAJOR_INTERVALS) {
        expect(IONIAN_INTERVALS).toContain(cent)
      }
    })

    it('BLUES contains the blue note (tritone)', () => {
      expect(BLUES_INTERVALS).toContain(Interval.Tritone)
    })
  })

  // ========================================================================
  // degreeToCents
  // ========================================================================

  describe('degreeToCents', () => {
    it('degree 1 = root (0 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 1)).toBe(0)
    })

    it('degree 3 in major = major third (400 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 3)).toBe(400)
    })

    it('degree 5 in major = perfect fifth (700 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 5)).toBe(700)
    })

    it('degree 8 in major = octave (1200 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 8)).toBe(1200)
    })

    it('degree 9 in major = octave + whole tone (1400 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 9)).toBe(1400)
    })

    it('degree 10 in major = octave + major third (1600 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 10)).toBe(1600)
    })

    it('degree 15 in major = 2 octaves (2400 cents)', () => {
      expect(degreeToCents(IONIAN_INTERVALS, 15)).toBe(2400)
    })

    it('works with pentatonic scale', () => {
      expect(degreeToCents(PENTATONIC_MAJOR_INTERVALS, 1)).toBe(0)      // root
      expect(degreeToCents(PENTATONIC_MAJOR_INTERVALS, 5)).toBe(900)     // major sixth
      expect(degreeToCents(PENTATONIC_MAJOR_INTERVALS, 6)).toBe(1200)    // octave (wraps)
      expect(degreeToCents(PENTATONIC_MAJOR_INTERVALS, 11)).toBe(2400)   // 2 octaves
    })

    it('handles negative degrees (wraps downward)', () => {
      // degree 0 in 7-note scale: idx = -1, baseIdx = 6, octaves = -1
      // → -1 * 1200 + 1100 = -100
      expect(degreeToCents(IONIAN_INTERVALS, 0)).toBe(-100)
    })

    it('degree -6 in major wraps to -1200 (one octave down)', () => {
      // idx = -7, baseIdx = 0, octaves = -1 → -1200 + 0 = -1200
      expect(degreeToCents(IONIAN_INTERVALS, -6)).toBe(-1200)
    })
  })
})
