/**
 * Builder Test — LoopBuilder
 *
 * Tests LoopBuilder (returned by `loop()` and `repeat()`), testing the builder
 * directly with createBridge + commitAndCapture.
 *
 * Covers:
 *   - loop(count?, ...steps) and .steps()
 *   - .count() chaining
 *   - repeat(count, source) as single-step loop
 *   - Tick advance through looped steps
 *   - Chaining with note()
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { loop } from '../../notations/loop'
import { repeat } from '../../notations/repeat'
import { note } from '../../notations/note'
import { LoopBuilder } from '../../builders/LoopBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

describe('LoopBuilder', () => {

  describe('loop() notation', () => {
    it('should return LoopBuilder instance', () => {
      const result = loop(1, note('C4'))
      expect(result).toBeInstanceOf(LoopBuilder)
    })

    it('loop() without count should default to 1 via .steps()', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop().steps(note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 60, duration: 480, tick: 0 })
    })

    it('loop(count, ...steps) should repeat steps count times', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop(3, note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 60, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 60, tick: 960 })
    })

    it('should loop multiple steps count times', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop(2, note('C4'), note('E4'), note('G4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(6)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[3].pitch).toBe(60)
      expect(notes[4].pitch).toBe(64)
      expect(notes[5].pitch).toBe(67)
    })

    it('should advance tick through looped steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = loop(2, note('C4'), note('E4')).apply(bridge)

      expect(result.tick).toBe(1920) // 4 notes * 480 ticks
    })
  })

  describe('.count() and .steps()', () => {
    it('should chain .count() and .steps() fluently', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop()
        .count(2)
        .steps(note('C4'), note('E4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(60)
      expect(notes[3].pitch).toBe(64)
    })

    it('should pass through bridge unchanged when no steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = loop().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })
  })

  describe('repeat() notation', () => {
    it('repeat(count, source) should return LoopBuilder', () => {
      const result = repeat(3, note('C4'))
      expect(result).toBeInstanceOf(LoopBuilder)
    })

    it('should repeat single step count times', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(4, note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 60, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 60, tick: 960 })
      expect(notes[3]).toMatchObject({ pitch: 60, tick: 1440 })
    })

    it('.count() should override repeat count', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(1, note('C4'))
        .count(3)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
    })
  })

  describe('chaining with note()', () => {
    it('should allow subsequent steps after loop', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = loop(2, note('C4')).apply(bridge)
      b = note('E4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(60)
      expect(notes[2].pitch).toBe(64)
    })

    it('should allow subsequent steps after repeat', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = repeat(2, note('C4')).apply(bridge)
      b = note('E4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(60)
      expect(notes[2].pitch).toBe(64)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = loop(1, note('C4'))
      const withCount = base.count(2)
      const withSteps = base.steps(note('E4'))

      expect(base).not.toBe(withCount)
      expect(base).not.toBe(withSteps)
    })

    it('modified builder should produce different output', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const base = loop(2, note('C4'))
      const withCount = base.count(3)

      const baseResult = commitAndCapture(base.apply(bridge))
      const countResult = commitAndCapture(withCount.apply(bridge))

      expect(baseResult.notes).toHaveLength(2)
      expect(countResult.notes).toHaveLength(3)
    })
  })
})
