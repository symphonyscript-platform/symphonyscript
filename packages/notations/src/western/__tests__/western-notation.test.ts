/**
 * WesternNotation — comprehensive test suite.
 *
 * Tests every abstract method implementation plus inherited methods,
 * including error paths.
 */

import {
  ChordSymbol,
  Degree,
  IntervalName,
  NoteName,
  PitchClass,
  ScaleMode
} from '@symphonyscript/core'
import { WesternNotation } from '../western.notation'
import '../types.d.ts'

describe('WesternNotation', () => {
  let n: WesternNotation

  beforeAll(() => {
    n = new WesternNotation()
  })

  // ==========================================================================
  // Identity & Config
  // ==========================================================================

  describe('Identity & Config', () => {
    it('getId → western', () => {
      expect(n.getId()).toBe('western')
    })

    it('getName → Western Standard', () => {
      expect(n.getName()).toBe('Western Standard')
    })

    it('getTuningHz → 440', () => {
      expect(n.getTuningHz()).toBe(440)
    })

    it('getPitchRange → { min: 0, max: 13200 }', () => {
      expect(n.getPitchRange()).toEqual({ min: 0, max: 13200 })
    })

    it('prefersFlats → false', () => {
      expect(n.prefersFlats()).toBe(false)
    })

    it('getCapabilities → all true', () => {
      expect(n.getCapabilities()).toEqual({
        chords: true,
        degrees: true,
        progressions: true,
      })
    })
  })

  // ==========================================================================
  // Notes
  // ==========================================================================

  describe('noteToCents', () => {
    it.each([
      ['C4', 6000],
      ['A4', 6900],
      ['F#3', 5400],
      ['Bb5', 8200],
      ['C0', 1200],
      ['C#4', 6100],
      ['Db4', 6100],
      ['B3', 5900],
      ['G5', 7900],
    ])('%s → %d', (note, expected) => {
      expect(n.noteToCents(note as unknown as NoteName)).toBe(expected)
    })

    it('throws on invalid input "xyz"', () => {
      expect(() => n.noteToCents('xyz' as unknown as NoteName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on empty string', () => {
      expect(() => n.noteToCents('' as unknown as NoteName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on note without octave "C"', () => {
      expect(() => n.noteToCents('C' as unknown as NoteName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on invalid letter "H4"', () => {
      expect(() => n.noteToCents('H4' as unknown as NoteName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('centsToNote', () => {
    it.each([
      [6000, 'C4'],
      [6900, 'A4'],
      [1200, 'C0'],
      [6100, 'C#4'],
      [7900, 'G5'],
    ])('%d → %s', (cents, expected) => {
      expect(n.centsToNote(cents)).toBe(expected)
    })

    it('throws on negative cents', () => {
      expect(() => n.centsToNote(-100)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on cents > 13200', () => {
      expect(() => n.centsToNote(14000)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  // ==========================================================================
  // Derived (inherited from BaseNotation)
  // ==========================================================================

  describe('Derived methods (inherited)', () => {
    it('noteToMidi C4 → 60', () => {
      expect(n.noteToMidi('C4')).toBe(60)
    })

    it('noteToMidi A4 → 69', () => {
      expect(n.noteToMidi('A4')).toBe(69)
    })

    it('noteToFrequency A4 → 440', () => {
      expect(n.noteToFrequency('A4')).toBeCloseTo(440, 1)
    })

    it('noteToFrequency A5 → 880', () => {
      expect(n.noteToFrequency('A5')).toBeCloseTo(880, 1)
    })

    it('transposeNote C4 + 700 → G4', () => {
      expect(n.transposeNote('C4', 700)).toBe('G4')
    })

    it('isEnharmonic C#4 / Db4 → true', () => {
      expect(n.isEnharmonic('C#4', 'Db4')).toBe(true)
    })

    it('isEnharmonic C4 / D4 → false', () => {
      expect(n.isEnharmonic('C4', 'D4')).toBe(false)
    })
  })

  // ==========================================================================
  // Intervals
  // ==========================================================================

  describe('intervalToCents', () => {
    it.each([
      ['P5', 700],
      ['m3', 300],
      ['M3', 400],
      ['P1', 0],
      ['P8', 1200],
      ['tritone', 600],
    ])('%s → %d', (name, expected) => {
      expect(n.intervalToCents(name as unknown as IntervalName)).toBe(expected)
    })

    it('throws on "xyz"', () => {
      expect(() => n.intervalToCents('xyz' as unknown as IntervalName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on empty string', () => {
      expect(() => n.intervalToCents('' as unknown as IntervalName)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('centsToInterval', () => {
    it('700 → P5', () => {
      expect(n.centsToInterval(700)).toBe('P5')
    })

    it('0 → P1', () => {
      expect(n.centsToInterval(0)).toBe('P1')
    })

    it('1900 wraps to P5', () => {
      expect(n.centsToInterval(1900)).toBe('P5')
    })

    it('throws on 150 (no match)', () => {
      expect(() => n.centsToInterval(150)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  // ==========================================================================
  // Scales
  // ==========================================================================

  describe('getScaleIntervals', () => {
    it('major → [0, 200, 400, 500, 700, 900, 1100]', () => {
      expect(n.getScaleIntervals('major')).toEqual([0, 200, 400, 500, 700, 900, 1100])
    })

    it('minor → proper minor intervals', () => {
      expect(n.getScaleIntervals('minor')).toEqual([0, 200, 300, 500, 700, 800, 1000])
    })

    it('case-insensitive: "Major" works', () => {
      expect(n.getScaleIntervals('Major' as unknown as ScaleMode)).toEqual([0, 200, 400, 500, 700, 900, 1100])
    })

    it('throws on "xyz"', () => {
      expect(() => n.getScaleIntervals('xyz' as unknown as ScaleMode)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('getSupportedScales', () => {
    it('returns non-empty array containing major and minor', () => {
      const scales = n.getSupportedScales()
      expect(scales.length).toBeGreaterThan(0)
      expect(scales).toContain('major')
      expect(scales).toContain('minor')
    })
  })

  // ==========================================================================
  // Key Signatures
  // ==========================================================================

  describe('getKeySignature', () => {
    it('C major → []', () => {
      expect(n.getKeySignature('C', 'major')).toEqual([])
    })

    it('D major → [F#, C#]', () => {
      expect(n.getKeySignature('D', 'major')).toEqual(['F#', 'C#'])
    })

    it('A minor → []', () => {
      expect(n.getKeySignature('A', 'minor')).toEqual([])
    })

    it('G major → [F#]', () => {
      expect(n.getKeySignature('G', 'major')).toEqual(['F#'])
    })

    it('throws on invalid root', () => {
      expect(() => n.getKeySignature('xyz' as unknown as PitchClass, 'major')).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on invalid mode', () => {
      expect(() => n.getKeySignature('C', 'xyz' as unknown as ScaleMode)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  // ==========================================================================
  // Degrees
  // ==========================================================================

  describe('degreeToCents', () => {
    const majorScale = [0, 200, 400, 500, 700, 900, 1100]

    it('I → 0', () => {
      expect(n.degreeToCents('I', majorScale)).toBe(0)
    })

    it('V → 700', () => {
      expect(n.degreeToCents('V', majorScale)).toBe(700)
    })

    it('bVII → 1000', () => {
      expect(n.degreeToCents('bVII', majorScale)).toBe(1000)
    })

    it('#IV → 600', () => {
      expect(n.degreeToCents('#IV', majorScale)).toBe(600)
    })

    it('throws on "xyz"', () => {
      expect(() => n.degreeToCents('xyz' as unknown as Degree, majorScale)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  // ==========================================================================
  // Chords
  // ==========================================================================

  describe('chordToIntervals', () => {
    it('maj7 → [0, 400, 700, 1100]', () => {
      expect(n.chordToIntervals('maj7')).toEqual([0, 400, 700, 1100])
    })

    it('m → [0, 300, 700]', () => {
      expect(n.chordToIntervals('m')).toEqual([0, 300, 700])
    })

    it('full chord code Cmaj7 → [0, 400, 700, 1100]', () => {
      expect(n.chordToIntervals('Cmaj7' as unknown as ChordSymbol)).toEqual([0, 400, 700, 1100])
    })

    it('full chord code F#m → [0, 300, 700]', () => {
      expect(n.chordToIntervals('F#m' as unknown as ChordSymbol)).toEqual([0, 300, 700])
    })

    it('throws on "Cxyz"', () => {
      expect(() => n.chordToIntervals('Cxyz' as unknown as ChordSymbol)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })

    it('throws on "xyz"', () => {
      expect(() => n.chordToIntervals('xyz' as unknown as ChordSymbol)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('intervalsToChord', () => {
    it('[0, 400, 700, 1100] → first matching suffix', () => {
      const result = n.intervalsToChord([0, 400, 700, 1100])
      expect(typeof result).toBe('string')
      // Should be 'maj7' or equivalent
      expect(n.chordToIntervals(result as unknown as ChordSymbol)).toEqual([0, 400, 700, 1100])
    })

    it('throws on unknown intervals', () => {
      expect(() => n.intervalsToChord([0, 123, 456])).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('getSupportedChords', () => {
    it('returns non-empty array', () => {
      const chords = n.getSupportedChords()
      expect(chords.length).toBeGreaterThan(0)
      expect(chords).toContain('maj7')
      expect(chords).toContain('m')
      expect(chords).toContain('7')
    })
  })

  // ==========================================================================
  // Progressions
  // ==========================================================================

  describe('resolveProgression', () => {
    const majorScale = [0, 200, 400, 500, 700, 900, 1100]

    it('I-V-vi-IV → 4 resolutions', () => {
      const result = n.resolveProgression(['I', 'V', 'vi', 'IV'], majorScale)
      expect(result).toHaveLength(4)
    })

    it('first result (I) has rootCents: 0', () => {
      const result = n.resolveProgression(['I', 'V', 'vi', 'IV'], majorScale)
      expect(result[0].rootCents).toBe(0)
    })

    it('second result (V) has rootCents: 700', () => {
      const result = n.resolveProgression(['I', 'V', 'vi', 'IV'], majorScale)
      expect(result[1].rootCents).toBe(700)
    })

    it('vi (lowercase) resolves to minor intervals', () => {
      const result = n.resolveProgression(['vi'], majorScale)
      expect(result[0].intervals).toEqual([0, 300, 700])
    })

    it('V7 resolves to dominant 7th intervals', () => {
      const result = n.resolveProgression(['V7'], majorScale)
      expect(result[0].intervals).toEqual([0, 400, 700, 1000])
    })

    it('ii7 resolves to minor 7th', () => {
      const result = n.resolveProgression(['ii7'], majorScale)
      expect(result[0].rootCents).toBe(200)
      expect(result[0].intervals).toEqual([0, 300, 700, 1000])
    })

    it('bVII resolves with flat accidental', () => {
      const result = n.resolveProgression(['bVII'], majorScale)
      expect(result[0].rootCents).toBe(1000)
    })

    it('throws on invalid numeral', () => {
      expect(() => n.resolveProgression(['I', 'xyz'] as unknown as Degree[], majorScale)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  // ==========================================================================
  // Rhythm
  // ==========================================================================

  describe('durationToTicks', () => {
    it.each([
      ['quarter', 480, 480],
      ['eighth', 480, 240],
      ['half', 480, 960],
      ['whole', 480, 1920],
      ['sixteenth', 480, 120],
      ['dotted.quarter', 480, 720],
    ])('%s at ppq %d → %d', (name, ppq, expected) => {
      expect(n.durationToTicks(name, ppq)).toBe(expected)
    })

    it('throws on "xyz"', () => {
      expect(() => n.durationToTicks('xyz', 480)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })

  describe('ticksToDuration', () => {
    it('480 at ppq 480 → quarter', () => {
      expect(n.ticksToDuration(480, 480)).toBe('quarter')
    })

    it('240 at ppq 480 → eighth', () => {
      expect(n.ticksToDuration(240, 480)).toBe('eighth')
    })

    it('960 at ppq 480 → half', () => {
      expect(n.ticksToDuration(960, 480)).toBe('half')
    })

    it('1920 at ppq 480 → whole', () => {
      expect(n.ticksToDuration(1920, 480)).toBe('whole')
    })

    it('throws on unmatchable tick count', () => {
      expect(() => n.ticksToDuration(7, 480)).toThrow(expect.objectContaining({ name: 'NotationInputError' }))
    })
  })
})
