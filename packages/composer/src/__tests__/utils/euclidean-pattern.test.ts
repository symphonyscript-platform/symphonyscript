/**
 * Tests for generateEuclideanPattern utility.
 *
 * Covers:
 *   - Happy path: valid hits/steps with rotation 0
 *   - Rotation: non-zero rotation returns rotated pattern
 *   - Edge cases: hits=0, steps=0, invalid inputs where euclidean returns null
 *   - Type verification: returned array elements are booleans
 */

import { describe, it, expect } from 'vitest'
import { generateEuclideanPattern } from '../../utils/euclidean-pattern'

describe('generateEuclideanPattern', () => {

  // ========================================================================
  // Happy path
  // ========================================================================

  describe('valid patterns', () => {
    it('should return tresillo pattern (3 hits, 8 steps) with rotation 0', () => {
      const result = generateEuclideanPattern(3, 8, 0)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(8)
      // Tresillo: x--x--x-
      expect(result).toEqual([true, false, false, true, false, false, true, false])
    })

    it('should return cinquillo pattern (5 hits, 8 steps) with rotation 0', () => {
      const result = generateEuclideanPattern(5, 8, 0)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(8)
      // Cinquillo: x-xx-xx-
      expect(result).toEqual([true, false, true, true, false, true, true, false])
    })

    it('should return full pattern when hits equals steps', () => {
      const result = generateEuclideanPattern(8, 8, 0)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(8)
      expect(result).toEqual([true, true, true, true, true, true, true, true])
    })

    it('should return all elements as booleans', () => {
      const result = generateEuclideanPattern(3, 8, 0)
      expect(result).not.toBeNull()
      result!.forEach((elt, i) => {
        expect(typeof elt).toBe('boolean')
      })
    })
  })

  // ========================================================================
  // Rotation
  // ========================================================================

  describe('rotation', () => {
    it('should apply positive rotation (rotate right)', () => {
      const base = generateEuclideanPattern(3, 8, 0)
      expect(base).toEqual([true, false, false, true, false, false, true, false])

      const rotated = generateEuclideanPattern(3, 8, 1)
      expect(rotated).not.toBeNull()
      // Rotate right by 1: last element moves to front
      expect(rotated).toEqual([false, true, false, false, true, false, false, true])
    })

    it('should apply negative rotation (rotate left)', () => {
      const base = generateEuclideanPattern(3, 8, 0)
      const rotated = generateEuclideanPattern(3, 8, -1)
      expect(rotated).not.toBeNull()
      // Rotate left by 1: first element moves to back
      expect(rotated).toEqual([false, false, true, false, false, true, false, true])
    })
  })

  // ========================================================================
  // Edge cases / null handling
  // ========================================================================

  describe('edge cases', () => {
    it('should return null when steps is 0', () => {
      expect(generateEuclideanPattern(3, 0, 0)).toBeNull()
    })

    it('should return null when hits is negative', () => {
      expect(generateEuclideanPattern(-1, 8, 0)).toBeNull()
    })

    it('should return null when steps is negative', () => {
      expect(generateEuclideanPattern(3, -1, 0)).toBeNull()
    })

    it('should return null when hits is NaN', () => {
      expect(generateEuclideanPattern(NaN, 8, 0)).toBeNull()
    })

    it('should return null when steps is NaN', () => {
      expect(generateEuclideanPattern(3, NaN, 0)).toBeNull()
    })

    it('should return null when steps is Infinity', () => {
      expect(generateEuclideanPattern(3, Infinity, 0)).toBeNull()
    })

    it('should return zeros pattern when hits is 0 (euclidean returns non-null)', () => {
      const result = generateEuclideanPattern(0, 8, 0)
      expect(result).not.toBeNull()
      expect(result).toHaveLength(8)
      expect(result).toEqual([false, false, false, false, false, false, false, false])
    })
  })
})
