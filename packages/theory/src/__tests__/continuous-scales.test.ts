/**
 * Tests for RFC-060: Cent-Based Scale Definitions.
 */

import { ScaleMode } from '../enums/scale-mode'
import { Interval } from '../continuous/intervals'
import {
  SCALE_INTERVALS,
  resolveScaleIntervals,
  degreeToCents,
} from '../continuous/scales'

describe('RFC-060: Cent-Based Scale Definitions', () => {
  // ========================================================================
  // SCALE_INTERVALS map
  // ========================================================================

  describe('SCALE_INTERVALS', () => {
    it('NONE is undefined', () => {
      expect(SCALE_INTERVALS[ScaleMode.NONE]).toBeUndefined()
    })

    // Expected sizes for each mode
    const expectedSizes: [ScaleMode, number][] = [
      [ScaleMode.MAJOR, 7],
      [ScaleMode.MINOR, 7],
      [ScaleMode.HARMONIC_MINOR, 7],
      [ScaleMode.MELODIC_MINOR, 7],
      [ScaleMode.DORIAN, 7],
      [ScaleMode.PHRYGIAN, 7],
      [ScaleMode.LYDIAN, 7],
      [ScaleMode.MIXOLYDIAN, 7],
      [ScaleMode.LOCRIAN, 7],
      [ScaleMode.PENTATONIC_MAJOR, 5],
      [ScaleMode.PENTATONIC_MINOR, 5],
      [ScaleMode.BLUES, 6],
      [ScaleMode.CHROMATIC, 12],
      [ScaleMode.WHOLE_TONE, 6],
      [ScaleMode.DIMINISHED_HW, 8],
      [ScaleMode.DIMINISHED_WH, 8],
      [ScaleMode.BEBOP_DOMINANT, 8],
      [ScaleMode.BEBOP_MAJOR, 8],
      [ScaleMode.HIRAJOSHI, 5],
      [ScaleMode.IN_SEN, 5],
      [ScaleMode.HUNGARIAN_MINOR, 7],
      [ScaleMode.PHRYGIAN_DOMINANT, 7],
    ]

    for (const [mode, size] of expectedSizes) {
      it(`${ScaleMode[mode]} has ${size} degrees`, () => {
        const intervals = SCALE_INTERVALS[mode]
        expect(intervals).toBeDefined()
        expect(intervals!).toHaveLength(size)
      })
    }

    // Structural invariants for all non-NONE modes
    const allModes = expectedSizes.map(([mode]) => mode)

    for (const mode of allModes) {
      const name = ScaleMode[mode]

      it(`${name} starts with 0 (unison)`, () => {
        expect(SCALE_INTERVALS[mode]![0]).toBe(0)
      })

      it(`${name} has all entries < 1200`, () => {
        for (const cent of SCALE_INTERVALS[mode]!) {
          expect(cent).toBeLessThan(1200)
        }
      })

      it(`${name} is sorted ascending`, () => {
        const intervals = SCALE_INTERVALS[mode]!
        for (let i = 1; i < intervals.length; i++) {
          expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
        }
      })
    }

    // Specific scale content checks
    it('MAJOR has correct intervals: 0-200-400-500-700-900-1100', () => {
      expect(SCALE_INTERVALS[ScaleMode.MAJOR]).toEqual([0, 200, 400, 500, 700, 900, 1100])
    })

    it('MINOR has correct intervals: 0-200-300-500-700-800-1000', () => {
      expect(SCALE_INTERVALS[ScaleMode.MINOR]).toEqual([0, 200, 300, 500, 700, 800, 1000])
    })

    it('CHROMATIC has 12 entries spaced 100 cents apart', () => {
      const chromatic = SCALE_INTERVALS[ScaleMode.CHROMATIC]!
      for (let i = 0; i < 12; i++) {
        expect(chromatic[i]).toBe(i * 100)
      }
    })

    it('WHOLE_TONE has 6 entries spaced 200 cents apart', () => {
      const wt = SCALE_INTERVALS[ScaleMode.WHOLE_TONE]!
      for (let i = 0; i < 6; i++) {
        expect(wt[i]).toBe(i * 200)
      }
    })

    it('PENTATONIC_MAJOR is a subset of MAJOR', () => {
      const pent = SCALE_INTERVALS[ScaleMode.PENTATONIC_MAJOR]!
      const major = SCALE_INTERVALS[ScaleMode.MAJOR]!
      for (const cent of pent) {
        expect(major).toContain(cent)
      }
    })

    it('BLUES contains the blue note (tritone)', () => {
      expect(SCALE_INTERVALS[ScaleMode.BLUES]).toContain(Interval.Tritone)
    })
  })

  // ========================================================================
  // resolveScaleIntervals
  // ========================================================================

  describe('resolveScaleIntervals', () => {
    it('returns intervals for MAJOR', () => {
      expect(resolveScaleIntervals(ScaleMode.MAJOR)).toBe(SCALE_INTERVALS[ScaleMode.MAJOR])
    })

    it('returns undefined for NONE', () => {
      expect(resolveScaleIntervals(ScaleMode.NONE)).toBeUndefined()
    })
  })

  // ========================================================================
  // degreeToCents
  // ========================================================================

  describe('degreeToCents', () => {
    const major = SCALE_INTERVALS[ScaleMode.MAJOR]!

    it('degree 1 = root (0 cents)', () => {
      expect(degreeToCents(major, 1)).toBe(0)
    })

    it('degree 3 in major = major third (400 cents)', () => {
      expect(degreeToCents(major, 3)).toBe(400)
    })

    it('degree 5 in major = perfect fifth (700 cents)', () => {
      expect(degreeToCents(major, 5)).toBe(700)
    })

    it('degree 8 in major = octave (1200 cents)', () => {
      expect(degreeToCents(major, 8)).toBe(1200)
    })

    it('degree 9 in major = octave + whole tone (1400 cents)', () => {
      expect(degreeToCents(major, 9)).toBe(1400)
    })

    it('degree 10 in major = octave + major third (1600 cents)', () => {
      expect(degreeToCents(major, 10)).toBe(1600)
    })

    it('degree 15 in major = 2 octaves (2400 cents)', () => {
      expect(degreeToCents(major, 15)).toBe(2400)
    })

    it('works with pentatonic scale', () => {
      const pent = SCALE_INTERVALS[ScaleMode.PENTATONIC_MAJOR]!
      expect(degreeToCents(pent, 1)).toBe(0)      // root
      expect(degreeToCents(pent, 5)).toBe(900)     // major sixth
      expect(degreeToCents(pent, 6)).toBe(1200)    // octave (wraps)
      expect(degreeToCents(pent, 11)).toBe(2400)   // 2 octaves
    })

    it('handles negative degrees (wraps downward)', () => {
      // degree 0 in 7-note scale: idx = -1, baseIdx = 6, octaves = -1
      // → -1 * 1200 + 1100 = -100
      expect(degreeToCents(major, 0)).toBe(-100)
    })

    it('degree -6 in major wraps to -1200 (one octave down)', () => {
      // idx = -7, baseIdx = 0, octaves = -1 → -1200 + 0 = -1200
      expect(degreeToCents(major, -6)).toBe(-1200)
    })
  })
})
