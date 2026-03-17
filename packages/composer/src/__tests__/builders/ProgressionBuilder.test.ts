/**
 * ProgressionBuilder Test
 *
 * Tests progression() — chord progression from roman numerals:
 *   - progression(['I', 'IV', 'V', 'I'])
 *   - duration, velocity
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { progression } from '../../cues/progression'
import { ProgressionBuilder } from '../../builders/ProgressionBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { note } from '../../cues/note'
import { PitchClass, ScaleMode } from '@symphonyscript/notations'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('ProgressionBuilder', () => {

  describe('progression roman numerals', () => {
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
    })

    it('progression with single chord should emit one chord', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = progression(['I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })
  })

  describe('duration and velocity', () => {
    it('should use explicit duration when provided', () => {
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

    it('should use bridge defaultDuration when duration not provided', () => {
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

    it('should use explicit velocity when provided', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = progression(['I']).velocity(900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(900)
    })
  })

  describe('modifiers', () => {
    it('.numerals() should replace progression', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = progression(['I'])
        .numerals(['I', 'V'])
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(6)
    })

    it('.duration() should override initial duration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = progression(['I', 'V'], 480).duration(120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = progression(['I', 'IV'])
      const withDur = original.duration(240)
      const withVel = original.velocity(900)

      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const origResult = commitAndCapture(original.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))
      const velResult = commitAndCapture(withVel.apply(bridge))

      expect(origResult.notes[0].duration).toBe(480)
      expect(durResult.notes[0].duration).toBe(240)
      expect(velResult.notes[0].velocity).toBe(900)
    })
  })

  describe('chaining with note', () => {
    it('progression then note should advance tick and emit both', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      let b: CompositionBridge = bridge
      b = progression(['I', 'V']).apply(b)
      b = note('C5').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(7) // 3 + 3 + 1
      expect(notes[6].pitch).toBe(72)
      expect(notes[6].tick).toBe(960) // 2 chords * 480
    })
  })
})
