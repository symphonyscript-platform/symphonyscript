/**
 * Tests for RFC-060: Continuous Pitch Model — Intervals & Temperament.
 */

import {
  Interval,
  ratioToCents,
  EQUAL_TEMPERAMENT,
  JUST_TEMPERAMENT,
  PYTHAGOREAN_TEMPERAMENT,
  MEANTONE_TEMPERAMENT,
  DEFAULT_TEMPERAMENT,
  resolveTemperament,
} from '../continuous'

describe('RFC-060: Continuous Pitch Model', () => {
  // ========================================================================
  // Interval Constants
  // ========================================================================

  describe('Interval constants', () => {
    it('has correct equal-tempered cent values', () => {
      expect(Interval.Unison).toBe(0)
      expect(Interval.Semitone).toBe(100)
      expect(Interval.WholeTone).toBe(200)
      expect(Interval.MinorThird).toBe(300)
      expect(Interval.MajorThird).toBe(400)
      expect(Interval.PerfectFourth).toBe(500)
      expect(Interval.Tritone).toBe(600)
      expect(Interval.PerfectFifth).toBe(700)
      expect(Interval.MinorSixth).toBe(800)
      expect(Interval.MajorSixth).toBe(900)
      expect(Interval.MinorSeventh).toBe(1000)
      expect(Interval.MajorSeventh).toBe(1100)
      expect(Interval.Octave).toBe(1200)
    })

    it('Octave minus PerfectFifth equals PerfectFourth', () => {
      expect(Interval.Octave - Interval.PerfectFifth).toBe(Interval.PerfectFourth)
    })

    it('MajorThird + MinorThird equals Tritone + Semitone', () => {
      expect(Interval.MajorThird + Interval.MinorThird).toBe(Interval.PerfectFifth + Interval.Unison)
    })
  })

  // ========================================================================
  // ratioToCents
  // ========================================================================

  describe('ratioToCents', () => {
    it('converts octave (2:1) to 1200 cents', () => {
      expect(ratioToCents(2)).toBe(1200)
    })

    it('converts unison (1:1) to 0 cents', () => {
      expect(ratioToCents(1)).toBe(0)
    })

    it('converts just perfect fifth (3:2) to ≈ 701.96 cents', () => {
      expect(ratioToCents(3 / 2)).toBeCloseTo(701.96, 1)
    })

    it('converts just major third (5:4) to ≈ 386.31 cents', () => {
      expect(ratioToCents(5 / 4)).toBeCloseTo(386.31, 1)
    })

    it('converts just minor third (6:5) to ≈ 315.64 cents', () => {
      expect(ratioToCents(6 / 5)).toBeCloseTo(315.64, 1)
    })

    it('converts just fourth (4:3) to ≈ 498.04 cents', () => {
      expect(ratioToCents(4 / 3)).toBeCloseTo(498.04, 1)
    })

    it('converts septimal seventh (7:4) to ≈ 968.83 cents', () => {
      expect(ratioToCents(7 / 4)).toBeCloseTo(968.83, 1)
    })

    it('handles sub-unison ratios (returns negative cents)', () => {
      expect(ratioToCents(1 / 2)).toBe(-1200)
    })
  })

  // ========================================================================
  // Temperament Presets
  // ========================================================================

  describe('Temperament presets', () => {
    const presets = [
      { name: 'EQUAL', value: EQUAL_TEMPERAMENT },
      { name: 'JUST', value: JUST_TEMPERAMENT },
      { name: 'PYTHAGOREAN', value: PYTHAGOREAN_TEMPERAMENT },
      { name: 'MEANTONE', value: MEANTONE_TEMPERAMENT },
    ]

    for (const { name, value } of presets) {
      describe(name, () => {
        it('has exactly 12 entries', () => {
          expect(value).toHaveLength(12)
        })

        it('starts with 0 (unison)', () => {
          expect(value[0]).toBe(0)
        })

        it('has all entries < 1200 (within one octave)', () => {
          for (const cent of value) {
            expect(cent).toBeLessThan(1200)
          }
        })

        it('is sorted ascending', () => {
          for (let i = 1; i < value.length; i++) {
            expect(value[i]).toBeGreaterThan(value[i - 1])
          }
        })
      })
    }

    it('EQUAL has 100-cent spacing', () => {
      for (let i = 0; i < 12; i++) {
        expect(EQUAL_TEMPERAMENT[i]).toBe(i * 100)
      }
    })

    it('JUST major third is close to ratioToCents(5/4)', () => {
      expect(JUST_TEMPERAMENT[4]).toBeCloseTo(ratioToCents(5 / 4), 0)
    })

    it('PYTHAGOREAN fifth is close to ratioToCents(3/2)', () => {
      expect(PYTHAGOREAN_TEMPERAMENT[7]).toBeCloseTo(ratioToCents(3 / 2), 0)
    })

    it('MEANTONE major third equals JUST major third', () => {
      expect(MEANTONE_TEMPERAMENT[4]).toBe(JUST_TEMPERAMENT[4])
    })

    it('DEFAULT_TEMPERAMENT is EQUAL_TEMPERAMENT', () => {
      expect(DEFAULT_TEMPERAMENT).toBe(EQUAL_TEMPERAMENT)
    })
  })

  // ========================================================================
  // resolveTemperament
  // ========================================================================

  describe('resolveTemperament', () => {
    it('resolves "equal" to EQUAL_TEMPERAMENT', () => {
      expect(resolveTemperament('equal')).toBe(EQUAL_TEMPERAMENT)
    })

    it('resolves "just" to JUST_TEMPERAMENT', () => {
      expect(resolveTemperament('just')).toBe(JUST_TEMPERAMENT)
    })

    it('resolves "pythagorean" to PYTHAGOREAN_TEMPERAMENT', () => {
      expect(resolveTemperament('pythagorean')).toBe(PYTHAGOREAN_TEMPERAMENT)
    })

    it('resolves "meantone" to MEANTONE_TEMPERAMENT', () => {
      expect(resolveTemperament('meantone')).toBe(MEANTONE_TEMPERAMENT)
    })

    it('passes through a custom cent array', () => {
      const custom = [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 1018, 1088]
      expect(resolveTemperament(custom)).toBe(custom)
    })

    it('throws on unknown preset name', () => {
      expect(() => resolveTemperament('gamelan' as any)).toThrow('Unknown temperament')
    })

    it('throws on array with fewer than 12 entries', () => {
      expect(() => resolveTemperament([0, 100, 200])).toThrow('at least 12 entries')
    })

    it('throws on empty array', () => {
      expect(() => resolveTemperament([])).toThrow('at least 12 entries')
    })
  })
})
