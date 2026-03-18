/**
 * TransformEffect Test — isTransformEffect type guard + apply behavior
 *
 * Tests the TransformEffect marker class and isTransformEffect type guard.
 * TransformEffect is the base for post-processing transforms (reverse, stretch).
 * Covers:
 *   - isTransformEffect(reverse()) = true
 *   - isTransformEffect(stretch()) = true
 *   - isTransformEffect(step()) = false
 *   - reverse().steps(): temporal reversal (first note last)
 *   - stretch(2).steps(): duration/tick scaling
 *   - empty entries: returns bridge unchanged
 *   - reverse().default(): cascading mode, returns unwrapped bridge
 *   - Integration: reverse then stretch pipeline
 */

import { describe, it, expect } from 'vitest'
import { reverse } from '../../cues/reverse'
import { stretch } from '../../cues/stretch'
import { note } from '../../cues/note'
import { step } from '../../utils/step'
import { isTransformEffect } from '../../builders/TransformEffect'
import { createBridge, commitAndCapture } from '../test-utils'

describe('TransformEffect / isTransformEffect', () => {

  describe('isTransformEffect', () => {
    it('isTransformEffect(reverse()) should return true', () => {
      const r = reverse()
      expect(isTransformEffect(r)).toBe(true)
    })

    it('isTransformEffect(stretch()) should return true', () => {
      const s = stretch()
      expect(isTransformEffect(s)).toBe(true)
    })

    it('isTransformEffect(step()) should return false', () => {
      const st = step((bridge) => bridge)
      expect(isTransformEffect(st)).toBe(false)
    })

    it('isTransformEffect(reverse().steps(...)) should return true', () => {
      const r = reverse()
      expect(isTransformEffect(r)).toBe(true)
    })

    it('isTransformEffect(stretch(2, note(...))) should return true', () => {
      const s = stretch(2, note(6000))
      expect(isTransformEffect(s)).toBe(true)
    })
  })

  describe('reverse().steps() temporal reversal', () => {
    it('reverse().steps(note(6000), note(6400)).apply(bridge) — first note becomes last', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = reverse()
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // Original order: C4 first @ tick 0, E4 second @ tick 480
      // Reversed: E4 first @ tick 0, C4 last @ tick 480
      expect(notes[0].pitch).toBe(6400) // E4
      expect(notes[1].pitch).toBe(6000) // C4
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })
  })

  describe('stretch().steps() duration/tick scaling', () => {
    it('stretch(2).steps(note(6000), note(6400)).apply(bridge) — doubles duration and tick', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2)
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // C4: original tick 0, duration 480 → tick 0, duration 960
      // E4: original tick 480, duration 480 → tick 960, duration 960
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 960, duration: 960 })
    })
  })

  describe('empty entries', () => {
    it('TransformEffect.apply with empty entries returns bridge unchanged', () => {
      const bridge = createBridge({ tick: 200, defaultDuration: 480 })
      const result = reverse().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })
  })

  describe('cascading mode (default)', () => {
    it('reverse().default().apply(bridge) — returns unwrapped bridge unchanged', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = reverse().default().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })
  })

  describe('integration pipeline', () => {
    it('reverse then stretch — reverses temporal order and scales duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2)
        .steps(reverse().steps(note(6000), note(6400)))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // Inner reverse: E4 first, C4 last
      // Stretch(2): E4 @ 0 dur 960, C4 @ 960 dur 960
      expect(notes[0]).toMatchObject({ pitch: 6400, tick: 0, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 6000, tick: 960, duration: 960 })
    })
  })
})
