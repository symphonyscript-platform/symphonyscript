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
      const result = repeat(3, note(6000))
      expect(result).toBeInstanceOf(LoopBuilder)
    })

    it('should repeat single step once when count is 1', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(1, note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 6000, duration: 480, tick: 0 })
    })

    it('should repeat single step count times', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(4, note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6000, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 6000, tick: 960 })
      expect(notes[3]).toMatchObject({ pitch: 6000, tick: 1440 })
    })

    it('should advance tick through repeated steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = repeat(3, note(6000)).apply(bridge)

      expect(result.tick).toBe(1440) // 3 notes * 480 ticks
    })

    it('should work with different pitches', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(2, note(6400)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6400)
      expect(notes[1].pitch).toBe(6400)
    })

    it('should allow subsequent steps after repeat', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = repeat(2, note(6000)).apply(bridge)
      b = note(6400).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[2].pitch).toBe(6400)
    })

    it('should chain .count() to override repeat count', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = repeat(1, note(6000))
        .count(3)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[2].pitch).toBe(6000)
    })
  })
})
