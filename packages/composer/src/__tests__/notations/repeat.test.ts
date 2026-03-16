/**
 * Repeat cue Test — repeat(count, source) returns LoopBuilder
 *
 * repeat() is a shorthand for looping a single step n times sequentially.
 * Equivalent to loop(count, source).
 */

import { describe, it, expect } from 'vitest'
import { repeat } from '../../cues/repeat'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { LoopBuilder } from '../../builders/LoopBuilder'

describe('repeat', () => {

  describe('repeat(count, source) returns LoopBuilder', () => {
    it('should return LoopBuilder instance', () => {
      const result = repeat(3, note('C4'))
      expect(result).toBeInstanceOf(LoopBuilder)
    })

    it('should repeat single step once when count is 1', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(1, note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 60, duration: 480, tick: 0 })
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

    it('should advance tick through repeated steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = repeat(3, note('C4')).apply(bridge)

      expect(result.tick).toBe(1440) // 3 notes * 480 ticks
    })

    it('should work with different pitches', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(2, note('E4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(64)
      expect(notes[1].pitch).toBe(64)
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

    it('should chain .count() to override repeat count', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(1, note('C4'))
        .count(3)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(60)
      expect(notes[2].pitch).toBe(60)
    })
  })
})
