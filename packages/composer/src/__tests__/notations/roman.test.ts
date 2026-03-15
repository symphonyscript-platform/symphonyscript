/**
 * Roman Notation Test — roman(numeral, duration) RomanBuilder
 *
 * Tests the roman() notation that emits chord tones from a roman numeral
 * in the current key/scale context.
 */

import { describe, it, expect } from 'vitest'
import { roman } from '../../notations/roman'
import { RomanBuilder } from '../../builders/RomanBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { note } from '../../notations/note'

describe('roman', () => {

  describe('return type', () => {
    it('roman() should return RomanBuilder', () => {
      const result = roman()
      expect(result).toBeInstanceOf(RomanBuilder)
    })

    it('roman(numeral) should return RomanBuilder', () => {
      const result = roman('I')
      expect(result).toBeInstanceOf(RomanBuilder)
    })

    it('roman(numeral, duration) should return RomanBuilder', () => {
      const result = roman('V7', 240)
      expect(result).toBeInstanceOf(RomanBuilder)
    })
  })

  describe('roman numeral resolution (C major)', () => {
    it('roman("I") in C major should emit C, E, G (pitches 60, 64, 67)', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('I').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('roman("V") in C major should emit G4, B4, D5 (pitches 67, 71, 74)', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('V').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(67)
      expect(notes[1].pitch).toBe(71)
      expect(notes[2].pitch).toBe(74)
    })

    it('roman("V7") in C major should emit G, B, D, F (4 notes)', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('V7').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(67)
    })

    it('roman("vi") in C major should emit A4, C5, E5 (minor)', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('vi').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(69)
      expect(notes[1].pitch).toBe(72)
      expect(notes[2].pitch).toBe(76)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('I', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('I').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('all notes at same tick', () => {
    it('roman chord tones should emit at same tick (simultaneous)', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('I').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
    })
  })

  describe('chaining with note', () => {
    it('roman then note should both emit', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      let b = roman('I').apply(bridge)
      b = note('C5').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[3].pitch).toBe(72)
    })
  })
})
