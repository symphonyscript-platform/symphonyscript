/**
 * RomanBuilder Test — roman() returns RomanBuilder
 *
 * Tests the RomanBuilder that emits chord tones from a roman numeral
 * in the current key/scale context. Covers:
 *   - Basic chord emission (I, V, V7, vi)
 *   - Numeral, duration, inversion, velocity
 *   - All notes at same tick (simultaneous)
 *   - Key/scale context (scaleRoot, scaleMode)
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { roman } from '../../notations/roman'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

describe('RomanBuilder', () => {

  // ========================================================================
  // Basic emission
  // ========================================================================

  describe('basic emission', () => {
    it('roman("I") in C major should emit C, E, G', () => {
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

    it('roman("V") in C major should emit G, B, D', () => {
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

    it('roman("V7") in C major should emit 4 notes', () => {
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

    it('roman("vi") in C major should emit minor chord', () => {
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

  // ========================================================================
  // Duration and velocity
  // ========================================================================

  describe('duration and velocity', () => {
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

    it('.velocity() should override bridge velocity', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = roman('I').velocity(900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(900)
    })

    it('.duration() should override constructor duration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = roman('I', 240).duration(120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })
  })

  // ========================================================================
  // Inversion
  // ========================================================================

  describe('inversion', () => {
    it('.inversion(1) should rotate chord tones', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = roman('I').inversion(1).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      // I in root: C E G. I inv 1: E G C (C up octave)
      expect(notes[0].pitch).toBe(64)
      expect(notes[1].pitch).toBe(67)
      expect(notes[2].pitch).toBe(72)
    })
  })

  // ========================================================================
  // Simultaneous notes
  // ========================================================================

  describe('simultaneous notes', () => {
    it('all chord tones should emit at same tick', () => {
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

  // ========================================================================
  // Tick advance
  // ========================================================================

  describe('tick advance', () => {
    it('should advance tick by chord duration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        tick: 0,
        defaultDuration: 480,
      })
      const result = roman('I').apply(bridge)

      expect(result.tick).toBe(480)
    })
  })

  // ========================================================================
  // Chaining
  // ========================================================================

  describe('chaining', () => {
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

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = roman('I')
      const withNumeral = original.numeral('V')
      const withDuration = original.duration(240)
      const withVelocity = original.velocity(500)

      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })

      const origResult = commitAndCapture(original.apply(bridge))
      const numeralResult = commitAndCapture(withNumeral.apply(bridge))
      const durResult = commitAndCapture(withDuration.apply(bridge))
      const velResult = commitAndCapture(withVelocity.apply(bridge))

      expect(origResult.notes[0].pitch).toBe(60)
      expect(numeralResult.notes[0].pitch).toBe(67)

      expect(origResult.notes[0].duration).toBe(480)
      expect(durResult.notes[0].duration).toBe(240)

      expect(origResult.notes[0].velocity).toBe(100)
      expect(velResult.notes[0].velocity).toBe(500)
    })
  })
})
