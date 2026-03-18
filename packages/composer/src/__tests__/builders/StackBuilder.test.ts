/**
 * Exemplar: StackBuilder Test
 *
 * Tests StackBuilder (returned by `stack()`).
 * StackBuilder is a structural composition primitive for parallel branches.
 *
 * Covers:
 *   - Parallel branches fork from same tick
 *   - Tick advances to longest branch
 *   - .branch() fluent API
 *   - Empty stack is a no-op
 *   - Single branch behaves like sequential
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { stack } from '../../cues/stack'
import { createBridge, commitAndCapture } from '../test-utils'

describe('StackBuilder', () => {

  // ========================================================================
  // Parallel forking
  // ========================================================================

  describe('parallel forking', () => {
    it('all branches should start at the same tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = stack(
        [note(6000)],
        [note(6400)],
        [note(6700)],
      ).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      // All notes should start at tick 0
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
    })

    it('tick should advance to the longest branch', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = stack(
        [note(6000)],                          // 1 note = 480 ticks
        [note(6400), note(6500), note(6700)],  // 3 notes = 1440 ticks
        [note(6900), note(7100)],              // 2 notes = 960 ticks
      ).apply(bridge)

      expect(result.tick).toBe(1440) // longest branch
    })
  })

  // ========================================================================
  // Builder API (.branch())
  // ========================================================================

  describe('.branch() API', () => {
    it('should support the .branch() fluent API', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = stack()
        .branch(note(6000), note(6400))
        .branch(note(6700))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      // First branch starts at 0, second branch also starts at 0
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
      expect(notes[2].tick).toBe(0)
    })
  })

  // ========================================================================
  // State isolation and structure
  // ========================================================================

  describe('state isolation', () => {
    it('velocity and transpose should not leak between parallel branches', () => {
      const bridge = createBridge({ velocity: 100 })

      const result = stack(
        [note(6000).velocity(500)],
        [note(6400)],  // no explicit velocity — use bridge default
        [note(6700).transpose(12)],
      ).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(500)
      expect(notes[1].velocity).toBe(100)
      expect(notes[2].pitch).toBe(6712)  // G4 + transpose(12) in cents
    })
  })

  describe('nested stacks', () => {
    it('stack within stack should work correctly', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const innerStack = stack([note(6400)], [note(6700)])

      const result = stack(
        [note(6000)],
        [innerStack],
      ).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
    })
  })

  describe('unequal durations', () => {
    it('branches with different durations should place notes at correct ticks', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = stack(
        [note(6000).duration(240)],
        [note(6400).duration(480), note(6700).duration(480)],
      ).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 240 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 0, duration: 480 })
      expect(notes[2]).toMatchObject({ pitch: 6700, tick: 480, duration: 480 })
      expect(result.tick).toBe(960)
    })
  })

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('empty stack should be a no-op', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stack().apply(bridge)

      expect(result.tick).toBe(0)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('single branch stack should behave like sequential steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stack([note(6000), note(6400)]).apply(bridge)

      expect(result.tick).toBe(960)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
    })
  })
})
