/**
 * degreeChord Notation Test — degreeChord(degrees, duration) DegreeChordBuilder
 *
 * Emits a chord built from scale degrees using the bridge's scale context.
 */

import { describe, it, expect } from 'vitest'
import { degreeChord } from '../../notations/degreeChord'
import { DegreeChordBuilder } from '../../builders/DegreeChordBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

describe('degreeChord', () => {

  describe('return type', () => {
    it('degreeChord() should return DegreeChordBuilder', () => {
      const result = degreeChord()
      expect(result).toBeInstanceOf(DegreeChordBuilder)
    })

    it('degreeChord([1,3,5]) should return DegreeChordBuilder', () => {
      const result = degreeChord([1, 3, 5])
      expect(result).toBeInstanceOf(DegreeChordBuilder)
    })

    it('degreeChord([1,3,5], 240) should return DegreeChordBuilder', () => {
      const result = degreeChord([1, 3, 5], 240)
      expect(result).toBeInstanceOf(DegreeChordBuilder)
    })
  })

  describe('scale degree chord resolution', () => {
    it('degreeChord([1,3,5]) in C major should emit C4, E4, G4 (60, 64, 67)', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1, 3, 5]).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)  // C4
      expect(notes[1].pitch).toBe(64)  // E4
      expect(notes[2].pitch).toBe(67)  // G4
    })

    it('degreeChord([1,3,5,7]) should emit four-note chord (1,3,5,7)', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1, 3, 5, 7]).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)  // C4
      expect(notes[1].pitch).toBe(64)  // E4
      expect(notes[2].pitch).toBe(67)  // G4
      expect(notes[3].pitch).toBe(71)  // B4
    })

    it('degreeChord([4,6,8]) in C major should emit IV chord (F, A, C)', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([4, 6, 8]).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(65)  // F4
      expect(notes[1].pitch).toBe(69)  // A4
      expect(notes[2].pitch).toBe(72)  // C5
    })

    it('should advance tick by chord duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = degreeChord([1, 3, 5]).apply(bridge)
      expect(result.tick).toBe(480)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1, 3, 5], 240).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1, 3, 5]).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('empty / no-op', () => {
    it('degreeChord([]) should emit no notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degreeChord([]).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('degreeChord() with no degrees should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = degreeChord().apply(bridge)
      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('builder chaining', () => {
    it('.degrees() should override degrees', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1])
        .degrees([1, 5])
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(67)
    })

    it('.duration() should override duration', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = degreeChord([1, 3, 5])
        .duration(120)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })
  })
})
