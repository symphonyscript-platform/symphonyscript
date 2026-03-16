/**
 * Tests for RFC-060: Cent-Based Chord Definitions.
 */

import { Interval } from '../continuous/intervals'
import { SCALE_INTERVALS } from '../continuous/scales'
import { ScaleMode } from '../enums/scale-mode'
import {
  CHORD_INTERVALS,
  CHORD_INTERVALS_MAP,
  resolveChordIntervals,
  romanToChordIntervals,
} from '../continuous/chords'

describe('RFC-060: Cent-Based Chord Definitions', () => {
  // ========================================================================
  // CHORD_INTERVALS object
  // ========================================================================

  describe('CHORD_INTERVALS', () => {
    const allChords = Object.keys(CHORD_INTERVALS) as (keyof typeof CHORD_INTERVALS)[]

    for (const key of allChords) {
      it(`${key} starts with 0 (root)`, () => {
        expect(CHORD_INTERVALS[key][0]).toBe(0)
      })

      it(`${key} has all entries < 1200`, () => {
        for (const cent of CHORD_INTERVALS[key]) {
          expect(cent).toBeLessThan(1200)
        }
      })

      it(`${key} is sorted ascending`, () => {
        const intervals = CHORD_INTERVALS[key]
        for (let i = 1; i < intervals.length; i++) {
          expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1])
        }
      })
    }

    // Specific chord content
    it('MAJ = [0, 400, 700] (3 notes)', () => {
      expect(CHORD_INTERVALS.MAJ).toEqual([0, 400, 700])
      expect(CHORD_INTERVALS.MAJ).toHaveLength(3)
    })

    it('MIN = [0, 300, 700] (3 notes)', () => {
      expect(CHORD_INTERVALS.MIN).toEqual([0, 300, 700])
      expect(CHORD_INTERVALS.MIN).toHaveLength(3)
    })

    it('DOM7 = [0, 400, 700, 1000] (4 notes)', () => {
      expect(CHORD_INTERVALS.DOM7).toEqual([0, 400, 700, 1000])
      expect(CHORD_INTERVALS.DOM7).toHaveLength(4)
    })

    it('MAJ6 has 4 notes (1-3-5-6)', () => {
      expect(CHORD_INTERVALS.MAJ6).toHaveLength(4)
      expect(CHORD_INTERVALS.MAJ6).toEqual([0, 400, 700, 900])
    })

    it('MIN6 has 4 notes (1-b3-5-6)', () => {
      expect(CHORD_INTERVALS.MIN6).toHaveLength(4)
      expect(CHORD_INTERVALS.MIN6).toEqual([0, 300, 700, 900])
    })

    it('DIM = [0, 300, 600] (3 notes)', () => {
      expect(CHORD_INTERVALS.DIM).toEqual([0, 300, 600])
    })

    it('AUG = [0, 400, 800] (3 notes)', () => {
      expect(CHORD_INTERVALS.AUG).toEqual([0, 400, 800])
    })

    it('POWER = [0, 700] (2 notes)', () => {
      expect(CHORD_INTERVALS.POWER).toEqual([0, 700])
    })

    it('DIM7 has symmetric structure (minor thirds)', () => {
      const [r, b3, b5, bb7] = CHORD_INTERVALS.DIM7
      expect(b3 - r).toBe(300)
      expect(b5 - b3).toBe(300)
      expect(bb7 - b5).toBe(300)
    })

    it('MAJ differs from MIN only in third', () => {
      expect(CHORD_INTERVALS.MAJ[0]).toBe(CHORD_INTERVALS.MIN[0])
      expect(CHORD_INTERVALS.MAJ[2]).toBe(CHORD_INTERVALS.MIN[2])
      expect(CHORD_INTERVALS.MAJ[1]).toBe(400)
      expect(CHORD_INTERVALS.MIN[1]).toBe(300)
    })
  })

  // ========================================================================
  // CHORD_INTERVALS_MAP
  // ========================================================================

  describe('CHORD_INTERVALS_MAP', () => {
    it('maps "" to MAJ', () => {
      expect(CHORD_INTERVALS_MAP.get('')).toBe(CHORD_INTERVALS.MAJ)
    })

    it('maps "m" to MIN', () => {
      expect(CHORD_INTERVALS_MAP.get('m')).toBe(CHORD_INTERVALS.MIN)
    })

    it('maps "7" to DOM7', () => {
      expect(CHORD_INTERVALS_MAP.get('7')).toBe(CHORD_INTERVALS.DOM7)
    })

    it('maps multiple symbols to same chord', () => {
      expect(CHORD_INTERVALS_MAP.get('maj')).toBe(CHORD_INTERVALS_MAP.get('M'))
      expect(CHORD_INTERVALS_MAP.get('m')).toBe(CHORD_INTERVALS_MAP.get('-'))
      expect(CHORD_INTERVALS_MAP.get('dim')).toBe(CHORD_INTERVALS_MAP.get('°'))
      expect(CHORD_INTERVALS_MAP.get('aug')).toBe(CHORD_INTERVALS_MAP.get('+'))
    })

    it('returns undefined for unknown symbol', () => {
      expect(CHORD_INTERVALS_MAP.get('unknown')).toBeUndefined()
    })

    it('has same number of entries as expected', () => {
      expect(CHORD_INTERVALS_MAP.size).toBeGreaterThan(70)
    })
  })

  // ========================================================================
  // resolveChordIntervals
  // ========================================================================

  describe('resolveChordIntervals', () => {
    it('resolves "m7" to MIN7 intervals', () => {
      expect(resolveChordIntervals('m7')).toBe(CHORD_INTERVALS.MIN7)
    })

    it('resolves "maj7" to MAJ7 intervals', () => {
      expect(resolveChordIntervals('maj7')).toBe(CHORD_INTERVALS.MAJ7)
    })

    it('resolves "" to MAJ intervals', () => {
      expect(resolveChordIntervals('')).toBe(CHORD_INTERVALS.MAJ)
    })

    it('returns undefined for unknown symbol', () => {
      expect(resolveChordIntervals('unknown')).toBeUndefined()
    })
  })

  // ========================================================================
  // romanToChord
  // ========================================================================

  describe('romanToChordIntervals', () => {
    const major = SCALE_INTERVALS[ScaleMode.MAJOR]!
    const minor = SCALE_INTERVALS[ScaleMode.MINOR]!

    it('I in major = root + major triad', () => {
      const result = romanToChordIntervals('I', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(0)
      expect(result!.intervals).toEqual([0, 400, 700])
    })

    it('V in major = 700 cents + major triad', () => {
      const result = romanToChordIntervals('V', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(700)
      expect(result!.intervals).toEqual([0, 400, 700])
    })

    it('V7 in major = 700 cents + dom7', () => {
      const result = romanToChordIntervals('V7', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(700)
      expect(result!.intervals).toEqual([0, 400, 700, 1000])
    })

    it('ii in major = 200 cents + minor triad', () => {
      const result = romanToChordIntervals('ii', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(200)
      expect(result!.intervals).toEqual([0, 300, 700])
    })

    it('IV in major = 500 cents + major triad', () => {
      const result = romanToChordIntervals('IV', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(500)
      expect(result!.intervals).toEqual([0, 400, 700])
    })

    it('viidim in major = 1100 cents + dim triad', () => {
      const result = romanToChordIntervals('viidim', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(1100)
      expect(result!.intervals).toEqual([0, 300, 600])
    })

    it('bVII in major = 1000 cents + major triad', () => {
      const result = romanToChordIntervals('bVII', major)
      expect(result).not.toBeNull()
      // VII = 1100 cents, b = -100 → 1000
      expect(result!.rootCents).toBe(1000)
      expect(result!.intervals).toEqual([0, 400, 700])
    })

    it('bIII in major = 200 cents + major triad', () => {
      const result = romanToChordIntervals('bIII', major)
      expect(result).not.toBeNull()
      // III = 400 cents, b = -100 → 300
      expect(result!.rootCents).toBe(300)
    })

    it('i in minor = 0 + minor triad', () => {
      const result = romanToChordIntervals('i', minor)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(0)
      expect(result!.intervals).toEqual([0, 300, 700])
    })

    it('returns null for invalid numeral', () => {
      expect(romanToChordIntervals('', major)).toBeNull()
      expect(romanToChordIntervals('invalid', major)).toBeNull()
      expect(romanToChordIntervals('VIII', major)).toBeNull()
    })

    it('ii7 in major = 200 cents + min7', () => {
      const result = romanToChordIntervals('ii7', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(200)
      // lowercase + "7" → quality becomes "m7"
      expect(result!.intervals).toBe(CHORD_INTERVALS.MIN7)
    })

    it('Imaj7 in major = 0 + maj7', () => {
      const result = romanToChordIntervals('Imaj7', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(0)
      expect(result!.intervals).toBe(CHORD_INTERVALS.MAJ7)
    })

    // Extended suffixes (would fail with hardcoded whitelist)

    it('V7b9 in major = 700 cents + DOM7_B9', () => {
      const result = romanToChordIntervals('V7b9', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(700)
      expect(result!.intervals).toBe(CHORD_INTERVALS.DOM7_B9)
    })

    it('Vaug7 in major = 700 cents + AUG7', () => {
      const result = romanToChordIntervals('Vaug7', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(700)
      expect(result!.intervals).toBe(CHORD_INTERVALS.AUG7)
    })

    it('V9 in major = 700 cents + DOM9', () => {
      const result = romanToChordIntervals('V9', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(700)
      expect(result!.intervals).toBe(CHORD_INTERVALS.DOM9)
    })

    it('ii9 in major = 200 cents + MIN9', () => {
      const result = romanToChordIntervals('ii9', major)
      expect(result).not.toBeNull()
      expect(result!.rootCents).toBe(200)
      expect(result!.intervals).toBe(CHORD_INTERVALS.MIN9)
    })
  })
})
