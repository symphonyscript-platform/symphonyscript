/**
 * Tests for applyBinaryPattern utility.
 *
 * applyBinaryPattern iterates over a binary pattern (0/1 or truthy/falsy),
 * emitting notes on hits (cycling through pitches) and advancing tick on rests.
 * Returns the resulting bridge without committing.
 *
 * Covers:
 *   - Happy path: correct notes and tick advancement
 *   - Pitch cycling when hits exceed pitches count
 *   - Optional velocity parameter
 *   - Empty pattern → no notes
 *   - All hits vs all rests
 *   - Truthy/falsy patterns (numbers and booleans)
 */

import { describe, it, expect } from 'vitest'
import { applyBinaryPattern } from '../../utils/binary-pattern'
import { createBridge, commitAndCapture } from '../test-utils'

describe('applyBinaryPattern', () => {

  // ========================================================================
  // Happy path
  // ========================================================================

  describe('happy path', () => {
    it('should emit notes on hits and advance tick on rests', () => {
      const bridge = createBridge()
      const pattern = [1, 0, 1, 0]
      const pitches = [6000, 6200]
      const duration = 4

      const result = applyBinaryPattern(pattern, pitches, duration, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      // First hit: pitch 60 at tick 0
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(4)
      // Second hit: pitch 62 at tick 8 (rest advanced by 4, then hit at 8)
      expect(notes[1].pitch).toBe(6200)
      expect(notes[1].tick).toBe(8)
      expect(notes[1].duration).toBe(4)
    })
  })

  // ========================================================================
  // Pitch cycling
  // ========================================================================

  describe('pitch cycling', () => {
    it('should cycle through pitches when hits exceed pitches count', () => {
      const bridge = createBridge()
      const pattern = [1, 1, 1, 1]
      const pitches = [6000, 6200]
      const duration = 4

      const result = applyBinaryPattern(pattern, pitches, duration, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6200)
      expect(notes[2].pitch).toBe(6000)
      expect(notes[3].pitch).toBe(6200)
    })
  })

  // ========================================================================
  // Velocity
  // ========================================================================

  describe('velocity', () => {
    it('should use bridge default velocity when not specified', () => {
      const bridge = createBridge({ velocity: 900 })
      const result = applyBinaryPattern([1], [6000], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(900)
    })

    it('should use optional velocity parameter when provided', () => {
      const bridge = createBridge({ velocity: 900 })
      const result = applyBinaryPattern([1], [6000], 4, bridge, 500)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(500)
    })
  })

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should produce no notes for empty pattern', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([], [6000], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(0)
    })

    it('should produce notes for all hits (no rests)', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([1, 1, 1], [6000], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(4)
      expect(notes[2].tick).toBe(8)
    })

    it('should produce no notes for all rests', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([0, 0, 0], [6000], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(12)
    })
  })

  // ========================================================================
  // Truthy/falsy patterns
  // ========================================================================

  describe('truthy/falsy patterns', () => {
    it('should treat numbers 0/1 as falsy/truthy', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([1, 0, 1], [6000, 6200], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6200)
    })

    it('should treat booleans as truthy/falsy', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([true, false, true], [6000, 6200], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6200)
    })

    it('should allow mixed numbers and booleans', () => {
      const bridge = createBridge()
      const result = applyBinaryPattern([1, false, true, 0], [6000, 6200], 4, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6200)
    })
  })
})
