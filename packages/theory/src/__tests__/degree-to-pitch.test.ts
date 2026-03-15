/**
 * Tests for degreeToPitch() in scales/helpers.ts
 */

import { degreeToPitch } from '../scales/helpers'
import { ScaleMode } from '../enums/scale-mode'

describe('degreeToPitch()', () => {
  // C major: C D E F G A B
  // At octave 4: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
  describe('C major scale', () => {
    it('resolves all 7 degrees', () => {
      expect(degreeToPitch(1, 0, ScaleMode.MAJOR, 4)).toBe(60)  // C4
      expect(degreeToPitch(2, 0, ScaleMode.MAJOR, 4)).toBe(62)  // D4
      expect(degreeToPitch(3, 0, ScaleMode.MAJOR, 4)).toBe(64)  // E4
      expect(degreeToPitch(4, 0, ScaleMode.MAJOR, 4)).toBe(65)  // F4
      expect(degreeToPitch(5, 0, ScaleMode.MAJOR, 4)).toBe(67)  // G4
      expect(degreeToPitch(6, 0, ScaleMode.MAJOR, 4)).toBe(69)  // A4
      expect(degreeToPitch(7, 0, ScaleMode.MAJOR, 4)).toBe(71)  // B4
    })
  })

  // G major: G A B C D E F#
  // At octave 4: G4=67, A4=69, B4=71, C5=72, D5=74, E5=76, F#5=78
  describe('G major scale', () => {
    it('resolves degree 1 (G4)', () => {
      expect(degreeToPitch(1, 7, ScaleMode.MAJOR, 4)).toBe(67)  // G4
    })

    it('resolves degree 7 (F#5)', () => {
      expect(degreeToPitch(7, 7, ScaleMode.MAJOR, 4)).toBe(78)  // F#5
    })
  })

  // A minor: A B C D E F G
  // At octave 4: A4=69, B4=71, C5=72, D5=74, E5=76, F5=77, G5=79
  describe('A minor scale', () => {
    it('resolves degree 1 (A4)', () => {
      expect(degreeToPitch(1, 9, ScaleMode.MINOR, 4)).toBe(69)  // A4
    })

    it('resolves degree 3 (C5)', () => {
      expect(degreeToPitch(3, 9, ScaleMode.MINOR, 4)).toBe(72)  // C5
    })
  })

  describe('octave wrapping', () => {
    it('degree 8 wraps to octave above', () => {
      expect(degreeToPitch(8, 0, ScaleMode.MAJOR, 4)).toBe(72)  // C5
    })

    it('degree 9 continues in next octave', () => {
      expect(degreeToPitch(9, 0, ScaleMode.MAJOR, 4)).toBe(74)  // D5
    })

    it('degree 15 wraps two octaves', () => {
      expect(degreeToPitch(15, 0, ScaleMode.MAJOR, 4)).toBe(84)  // C6
    })
  })

  describe('alteration', () => {
    it('raises pitch by semitone', () => {
      // Degree 4 in C major = F4 (65), raised = F#4 (66)
      expect(degreeToPitch(4, 0, ScaleMode.MAJOR, 4, 1)).toBe(66)
    })

    it('lowers pitch by semitone', () => {
      // Degree 7 in C major = B4 (71), lowered = Bb4 (70)
      expect(degreeToPitch(7, 0, ScaleMode.MAJOR, 4, -1)).toBe(70)
    })
  })

  describe('octave offset', () => {
    it('shifts up one octave', () => {
      expect(degreeToPitch(1, 0, ScaleMode.MAJOR, 4, 0, 1)).toBe(72)  // C5
    })

    it('shifts down one octave', () => {
      expect(degreeToPitch(1, 0, ScaleMode.MAJOR, 4, 0, -1)).toBe(48)  // C3
    })
  })

  describe('different base octaves', () => {
    it('octave 0', () => {
      expect(degreeToPitch(1, 0, ScaleMode.MAJOR, 0)).toBe(12)  // C0
    })

    it('octave 5', () => {
      expect(degreeToPitch(1, 0, ScaleMode.MAJOR, 5)).toBe(72)  // C5
    })
  })

  describe('pentatonic scale', () => {
    // C pentatonic major: C D E G A (5 notes)
    it('resolves 5 degrees', () => {
      expect(degreeToPitch(1, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(60)  // C4
      expect(degreeToPitch(2, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(62)  // D4
      expect(degreeToPitch(3, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(64)  // E4
      expect(degreeToPitch(4, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(67)  // G4
      expect(degreeToPitch(5, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(69)  // A4
    })

    it('degree 6 wraps to next octave', () => {
      expect(degreeToPitch(6, 0, ScaleMode.PENTATONIC_MAJOR, 4)).toBe(72)  // C5
    })
  })

  describe('invalid mode', () => {
    it('returns null for NONE mode', () => {
      expect(degreeToPitch(1, 0, ScaleMode.NONE, 4)).toBeNull()
    })

    it('returns null for unknown mode', () => {
      expect(degreeToPitch(1, 0, 999 as ScaleMode, 4)).toBeNull()
    })
  })

  describe('different root pitch classes', () => {
    it('D major degree 1', () => {
      // D = pitch class 2, D4 = 62
      expect(degreeToPitch(1, 2, ScaleMode.MAJOR, 4)).toBe(62)
    })

    it('F# major degree 1', () => {
      // F# = pitch class 6, F#4 = 66
      expect(degreeToPitch(1, 6, ScaleMode.MAJOR, 4)).toBe(66)
    })
  })
})
