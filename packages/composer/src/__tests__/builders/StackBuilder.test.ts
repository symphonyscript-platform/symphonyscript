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
import { note } from '../../notations/note'
import { stack } from '../../notations/stack'
import { createBridge, commitAndCapture } from '../test-utils'

describe('StackBuilder', () => {

  // ========================================================================
  // Parallel forking
  // ========================================================================

  describe('parallel forking', () => {
    it('all branches should start at the same tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = stack(
        [note('C4')],
        [note('E4')],
        [note('G4')],
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
        [note('C4')],                          // 1 note = 480 ticks
        [note('E4'), note('F4'), note('G4')],  // 3 notes = 1440 ticks
        [note('A4'), note('B4')],              // 2 notes = 960 ticks
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
        .branch(note('C4'), note('E4'))
        .branch(note('G4'))
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
      const result = stack([note('C4'), note('E4')]).apply(bridge)

      expect(result.tick).toBe(960)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
    })
  })
})
