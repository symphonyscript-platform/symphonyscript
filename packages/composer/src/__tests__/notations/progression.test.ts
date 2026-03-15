/**
 * Progression Notation Test — progression(numerals, duration?)
 *
 * progression() emits chord tones for each roman numeral in sequence.
 * Uses bridge key context (scaleRoot, scaleMode) for resolution.
 */

import { describe, it, expect } from 'vitest'
import { progression } from '../../notations/progression'
import { ProgressionBuilder } from '../../builders/ProgressionBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { note } from '../../notations/note'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

describe('progression', () => {
  describe('return type', () => {
    it('progression(numerals) should return ProgressionBuilder', () => {
      const result = progression(['I', 'IV', 'V', 'I'])
      expect(result).toBeInstanceOf(ProgressionBuilder)
    })

    it('progression(numerals, duration) should return ProgressionBuilder', () => {
      const result = progression(['I', 'iv', 'V7'], 240)
      expect(result).toBeInstanceOf(ProgressionBuilder)
    })
  })

  describe('progression emission (C major)', () => {
    it('progression(["I", "IV", "V", "I"]) should emit I, IV, V, I chords', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I', 'IV', 'V', 'I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      // I = CEG (3), IV = FAC (3), V = GBD (3), I = CEG (3) = 12 notes
      expect(notes).toHaveLength(12)
      // I: C4=60, E4=64, G4=67
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      // IV: F4=65, A4=69, C5=72
      expect(notes[3].pitch).toBe(65)
      expect(notes[4].pitch).toBe(69)
      expect(notes[5].pitch).toBe(72)
      // V: G4=67, B4=71, D5=74
      expect(notes[6].pitch).toBe(67)
      expect(notes[7].pitch).toBe(71)
      expect(notes[8].pitch).toBe(74)
      // I again
      expect(notes[9].pitch).toBe(60)
      expect(notes[10].pitch).toBe(64)
      expect(notes[11].pitch).toBe(67)
    })

    it('progression with explicit duration should use it for each chord', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I', 'V'], 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(6) // 3 + 3
      expect(notes[0].duration).toBe(240)
      expect(notes[3].duration).toBe(240)
    })

    it('progression without duration should use bridge defaultDuration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 360,
        velocity: 100,
      })
      const result = progression(['I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(360)
    })

    it('progression(["ii", "V7", "I"]) ii-V-I should emit correct chords', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['ii', 'V7', 'I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      // ii = Dm (3), V7 = G7 (4), I = C (3) = 10 notes
      expect(notes).toHaveLength(10)
      // ii: D4=62
      expect(notes[0].pitch).toBe(62)
      // V7: G4=67, B4=71, D5=74, F5=77
      expect(notes[3].pitch).toBe(67)
      expect(notes[4].pitch).toBe(71)
      expect(notes[5].pitch).toBe(74)
      expect(notes[6].pitch).toBe(77)
      // I: C4=60
      expect(notes[7].pitch).toBe(60)
    })

    it('progression empty numerals should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = progression([]).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(0)
    })

    it('should advance tick through progression', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I', 'IV']).apply(bridge)
      expect(result.tick).toBe(960) // 480 * 2 chords
    })
  })

  describe('builder chaining', () => {
    it('.duration() should override duration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I'])
        .duration(120)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })

    it('.velocity() should override velocity', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I'])
        .velocity(900)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(900)
    })
  })

  describe('chaining with note', () => {
    it('progression then note should both emit', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      let b = progression(['I']).apply(bridge)
      b = note('C5').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4) // 3 from I + 1 from note C5
      expect(notes[3].pitch).toBe(72)
    })
  })
})
