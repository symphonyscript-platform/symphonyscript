/**
 * Loop Notation Test — loop(count?, ...steps) returns LoopBuilder
 *
 * loop() creates a LoopBuilder that applies the given steps n times in sequence.
 * Default count is 1 when omitted.
 */

import { describe, it, expect } from 'vitest'
import { loop } from '../../notations/loop'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { LoopBuilder } from '../../builders/LoopBuilder'

describe('loop', () => {

  describe('loop(count?, ...steps) returns LoopBuilder', () => {
    it('should return LoopBuilder instance', () => {
      const result = loop(1, note('C4'))
      expect(result).toBeInstanceOf(LoopBuilder)
    })

    it('should apply steps once when count omitted via .steps() (default 1)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop().steps(note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 60, duration: 480, tick: 0 })
    })

    it('should apply steps once with explicit count(1)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = loop(1, note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })

    it('should repeat single step count times', () => {
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
  })
})
