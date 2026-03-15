/**
 * Tests for validate utilities.
 *
 * Covers:
 *   - assertRange: value must be between min and max
 *   - assertPositive: value must be > 0
 *   - assertNonNegative: value must be >= 0
 *   - assertInteger: value must be an integer
 *
 * Each validator: happy path, edge cases (boundaries), error cases (correct type + message).
 */

import { describe, it, expect } from 'vitest'
import { assertRange, assertPositive, assertNonNegative, assertInteger } from '../../utils/validate'

describe('validate', () => {

  // ========================================================================
  // assertRange
  // ========================================================================

  describe('assertRange', () => {
    it('should not throw when value is within range', () => {
      expect(() => assertRange('foo', 5, 0, 10)).not.toThrow()
    })

    it('should not throw when value equals min (boundary)', () => {
      expect(() => assertRange('foo', 0, 0, 10)).not.toThrow()
    })

    it('should not throw when value equals max (boundary)', () => {
      expect(() => assertRange('foo', 10, 0, 10)).not.toThrow()
    })

    it('should throw RangeError when value < min', () => {
      expect(() => assertRange('foo', -1, 0, 10)).toThrow(RangeError)
      expect(() => assertRange('foo', -1, 0, 10)).toThrow(
        'foo must be between 0 and 10, got -1'
      )
    })

    it('should throw RangeError when value > max', () => {
      expect(() => assertRange('foo', 11, 0, 10)).toThrow(RangeError)
      expect(() => assertRange('foo', 11, 0, 10)).toThrow(
        'foo must be between 0 and 10, got 11'
      )
    })
  })

  // ========================================================================
  // assertPositive
  // ========================================================================

  describe('assertPositive', () => {
    it('should not throw when value is positive', () => {
      expect(() => assertPositive('foo', 1)).not.toThrow()
      expect(() => assertPositive('foo', 100)).not.toThrow()
    })

    it('should throw RangeError when value is zero', () => {
      expect(() => assertPositive('foo', 0)).toThrow(RangeError)
      expect(() => assertPositive('foo', 0)).toThrow('foo must be positive, got 0')
    })

    it('should throw RangeError when value is negative', () => {
      expect(() => assertPositive('foo', -1)).toThrow(RangeError)
      expect(() => assertPositive('foo', -1)).toThrow('foo must be positive, got -1')
    })
  })

  // ========================================================================
  // assertNonNegative
  // ========================================================================

  describe('assertNonNegative', () => {
    it('should not throw when value is positive', () => {
      expect(() => assertNonNegative('foo', 1)).not.toThrow()
    })

    it('should not throw when value is zero (boundary)', () => {
      expect(() => assertNonNegative('foo', 0)).not.toThrow()
    })

    it('should throw RangeError when value is negative', () => {
      expect(() => assertNonNegative('foo', -1)).toThrow(RangeError)
      expect(() => assertNonNegative('foo', -1)).toThrow(
        'foo must be non-negative, got -1'
      )
    })
  })

  // ========================================================================
  // assertInteger
  // ========================================================================

  describe('assertInteger', () => {
    it('should not throw when value is an integer', () => {
      expect(() => assertInteger('foo', 0)).not.toThrow()
      expect(() => assertInteger('foo', 5)).not.toThrow()
      expect(() => assertInteger('foo', -3)).not.toThrow()
    })

    it('should throw TypeError when value is a float', () => {
      expect(() => assertInteger('foo', 3.14)).toThrow(TypeError)
      expect(() => assertInteger('foo', 3.14)).toThrow('foo must be an integer, got 3.14')
    })

    it('should throw TypeError when value is NaN', () => {
      expect(() => assertInteger('foo', NaN)).toThrow(TypeError)
      expect(() => assertInteger('foo', NaN)).toThrow('foo must be an integer, got NaN')
    })

    it('should throw TypeError when value is Infinity', () => {
      expect(() => assertInteger('foo', Infinity)).toThrow(TypeError)
      expect(() => assertInteger('foo', Infinity)).toThrow(
        'foo must be an integer, got Infinity'
      )
    })
  })
})
