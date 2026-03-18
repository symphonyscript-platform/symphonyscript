/**
 * Tests for pitch utilities.
 *
 * NOTE: resolvePitch/resolvePitches were removed; pitch resolution is now
 * deferred to apply-time via bridge.notation().noteToCents().
 */

import { describe, it, expect } from 'vitest'

describe.skip('pitch (utils removed — resolution deferred to notation)', () => {

  // ========================================================================
  // resolvePitch
  // ========================================================================

  describe('resolvePitch', () => {
    describe('number passthrough', () => {
      it('returns number as-is when input is number', () => {
        expect(resolvePitch(60)).toBe(60)
      })

      it('returns zero for MIDI 0', () => {
        expect(resolvePitch(0)).toBe(0)
      })

      it('returns 127 for MIDI 127', () => {
        expect(resolvePitch(127)).toBe(127)
      })
    })

    describe('valid note names', () => {
      it('parses C4 to 60 (middle C)', () => {
        expect(resolvePitch(6000)).toBe(60)
      })

      it('parses A4 to 69', () => {
        expect(resolvePitch(6900)).toBe(69)
      })

      it('parses sharp accidentals (F#3, C#4)', () => {
        expect(resolvePitch(5400)).toBe(54)
        expect(resolvePitch(6100)).toBe(61)
      })

      it('parses flat accidentals (Db4, Bb3)', () => {
        expect(resolvePitch(6100)).toBe(61)
        expect(resolvePitch(5800)).toBe(58)
      })

      it('parses negative octaves (C-1)', () => {
        expect(resolvePitch(0)).toBe(0)
      })
    })

    describe('invalid note names throw', () => {
      it('throws Error when note is empty string', () => {
        expect(() => resolvePitch('')).toThrow(Error)
        expect(() => resolvePitch('')).toThrow('Invalid note name: ')
      })

      it('throws Error when note is invalid text', () => {
        expect(() => resolvePitch('invalid')).toThrow(Error)
        expect(() => resolvePitch('invalid')).toThrow('Invalid note name: invalid')
      })

      it('throws Error when note is out of range (C-2)', () => {
        expect(() => resolvePitch(-1200)).toThrow(Error)
        expect(() => resolvePitch(-1200)).toThrow('Invalid note name: C-2')
      })

      it('throws Error when note is out of range (G#9)', () => {
        expect(() => resolvePitch(12800)).toThrow(Error)
        expect(() => resolvePitch(12800)).toThrow('Invalid note name: G#9')
      })
    })
  })

  // ========================================================================
  // resolvePitches
  // ========================================================================

  describe('resolvePitches', () => {
    it('maps resolvePitch over array of numbers', () => {
      expect(resolvePitches([60, 64, 67])).toEqual([60, 64, 67])
    })

    it('maps resolvePitch over array of note names', () => {
      expect(resolvePitches([6000, 6400, 6700])).toEqual([60, 64, 67])
    })

    it('handles mixed numbers and note names', () => {
      expect(resolvePitches([60, 6400, 67])).toEqual([60, 64, 67])
    })

    it('returns empty array for empty input', () => {
      expect(resolvePitches([])).toEqual([])
    })

    it('throws when any element is invalid', () => {
      expect(() => resolvePitches([6000, 'invalid', 6700])).toThrow('Invalid note name: invalid')
    })
  })
})
