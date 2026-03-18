/**
 * Exemplar: parseChord Utility Test
 *
 * NOTE: utils/chord (parseChord) was removed; chord resolution is now
 * deferred to apply-time via bridge.notation().
 */

import { describe, it, expect } from 'vitest'

describe.skip('parseChord (utils/chord removed — chord resolution deferred to notation)', () => {

  // ========================================================================
  // Triads
  // ========================================================================

  describe('triads', () => {
    it('should parse C major triad (empty suffix)', () => {
      const { root, mask } = parseChord('C')
      expect(root).toBe(60)  // C4
      const intervals = unpackToArray(mask)
      // C major = [0, 4, 7] in 12-TET → [0, 8, 14] in 24-EDO
      expect(intervals).toEqual([0, 8, 14])
    })

    it('should parse explicit "maj" suffix', () => {
      const { root, mask } = parseChord('Cmaj')
      expect(root).toBe(60)
      const intervals = unpackToArray(mask)
      expect(intervals).toEqual([0, 8, 14])
    })

    it('should parse minor triad', () => {
      const { root, mask } = parseChord('Am')
      expect(root).toBe(69)  // A4 (60 + 9)
      const intervals = unpackToArray(mask)
      // A minor = [0, 3, 7] → [0, 6, 14] in 24-EDO
      expect(intervals).toEqual([0, 6, 14])
    })

    it('should parse diminished triad', () => {
      const { root, mask } = parseChord('Bdim')
      expect(root).toBe(71)  // B4 (60 + 11)
      const intervals = unpackToArray(mask)
      // dim = [0, 3, 6] → [0, 6, 12] in 24-EDO
      expect(intervals).toEqual([0, 6, 12])
    })

    it('should parse augmented triad', () => {
      const { root, mask } = parseChord('Caug')
      expect(root).toBe(60)
      const intervals = unpackToArray(mask)
      // aug = [0, 4, 8] → [0, 8, 16] in 24-EDO
      expect(intervals).toEqual([0, 8, 16])
    })
  })

  // ========================================================================
  // Seventh chords
  // ========================================================================

  describe('seventh chords', () => {
    it('should parse major seventh', () => {
      const { root, mask } = parseChord('Cmaj7')
      expect(root).toBe(60)
      const intervals = unpackToArray(mask)
      // maj7 = [0, 4, 7, 11] → [0, 8, 14, 22] in 24-EDO
      expect(intervals).toEqual([0, 8, 14, 22])
    })

    it('should parse dominant seventh', () => {
      const { root, mask } = parseChord('G7')
      expect(root).toBe(67)  // G4 (60 + 7)
      const intervals = unpackToArray(mask)
      // 7 = [0, 4, 7, 10] → [0, 8, 14, 20] in 24-EDO
      expect(intervals).toEqual([0, 8, 14, 20])
    })

    it('should parse minor seventh', () => {
      const { root, mask } = parseChord('Dm7')
      expect(root).toBe(62)  // D4 (60 + 2)
      const intervals = unpackToArray(mask)
      // m7 = [0, 3, 7, 10] → [0, 6, 14, 20] in 24-EDO
      expect(intervals).toEqual([0, 6, 14, 20])
    })

    it('should parse half-diminished seventh (m7b5)', () => {
      const { root, mask } = parseChord('Bm7b5')
      expect(root).toBe(71)
      const intervals = unpackToArray(mask)
      // m7b5 = [0, 3, 6, 10] → [0, 6, 12, 20] in 24-EDO
      expect(intervals).toEqual([0, 6, 12, 20])
    })
  })

  // ========================================================================
  // Suspensions
  // ========================================================================

  describe('suspensions', () => {
    it('should parse sus4', () => {
      const { root, mask } = parseChord('Csus4')
      expect(root).toBe(60)
      const intervals = unpackToArray(mask)
      // sus4 = [0, 5, 7] → [0, 10, 14] in 24-EDO
      expect(intervals).toEqual([0, 10, 14])
    })

    it('should parse sus2', () => {
      const { root, mask } = parseChord('Dsus2')
      expect(root).toBe(62)
      const intervals = unpackToArray(mask)
      // sus2 = [0, 2, 7] → [0, 4, 14] in 24-EDO
      expect(intervals).toEqual([0, 4, 14])
    })
  })

  // ========================================================================
  // Accidentals
  // ========================================================================

  describe('accidentals', () => {
    it('should parse sharp root', () => {
      const { root } = parseChord('F#')
      expect(root).toBe(66)  // F# = 60 + 6
    })

    it('should parse flat root', () => {
      const { root } = parseChord('Bb')
      expect(root).toBe(70)  // Bb = 60 + 10
    })

    it('should parse sharp root with quality', () => {
      const { root, mask } = parseChord('C#m')
      expect(root).toBe(61)  // C# = 60 + 1
      const intervals = unpackToArray(mask)
      expect(intervals).toEqual([0, 6, 14])  // minor
    })

    it('should parse Gb diminished', () => {
      const { root, mask } = parseChord('Gbdim')
      expect(root).toBe(66)  // Gb = 60 + 6
      const intervals = unpackToArray(mask)
      expect(intervals).toEqual([0, 6, 12])  // dim
    })
  })

  // ========================================================================
  // Error handling
  // ========================================================================

  describe('error handling', () => {
    it('should throw on empty string', () => {
      expect(() => parseChord('')).toThrow('Empty chord symbol')
    })

    it('should throw on invalid root note', () => {
      expect(() => parseChord('X')).toThrow('Invalid chord root note')
    })

    it('should throw on unknown quality suffix', () => {
      expect(() => parseChord('Cxyz')).toThrow('Unknown chord quality')
    })
  })
})
