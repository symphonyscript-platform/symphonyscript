/**
 * Tests the `partitionEffects` utility which splits effects into interceptors
 * (regular PipeStep) vs transforms (TransformEffect).
 *
 * Covers:
 *   - Empty array returns empty interceptors and transforms
 *   - All interceptors: only regular PipeSteps go to interceptors
 *   - All transforms: only TransformEffect instances go to transforms
 *   - Mixed order preserved: both groups preserve user-specified order
 */

import { describe, it, expect } from 'vitest'
import { partitionEffects } from '../../utils/partition-effects'
import { step } from '../../utils/step'
import { ReverseBuilder } from '../../builders/ReverseBuilder'
import { StretchBuilder } from '../../builders/StretchBuilder'

describe('partitionEffects', () => {

  // ========================================================================
  // Empty array
  // ========================================================================

  describe('empty array', () => {
    it('should return empty interceptors and empty transforms', () => {
      const result = partitionEffects([])
      expect(result.interceptors).toEqual([])
      expect(result.transforms).toEqual([])
    })
  })

  // ========================================================================
  // All interceptors
  // ========================================================================

  describe('all interceptors', () => {
    it('should place all regular PipeSteps in interceptors', () => {
      const a = step((b) => b)
      const b = step((bridge) => bridge.withTick(bridge.tick + 1))
      const effects = [a, b]

      const result = partitionEffects(effects)

      expect(result.interceptors).toHaveLength(2)
      expect(result.interceptors[0]).toBe(a)
      expect(result.interceptors[1]).toBe(b)
      expect(result.transforms).toEqual([])
    })

    it('should preserve order of multiple interceptors', () => {
      const steps = [
        step((b) => b),
        step((b) => b),
        step((b) => b),
      ]
      const result = partitionEffects(steps)
      expect(result.interceptors).toHaveLength(3)
      expect(result.interceptors[0]).toBe(steps[0])
      expect(result.interceptors[1]).toBe(steps[1])
      expect(result.interceptors[2]).toBe(steps[2])
    })
  })

  // ========================================================================
  // All transforms
  // ========================================================================

  describe('all transforms', () => {
    it('should place all TransformEffect instances in transforms', () => {
      const rev = new ReverseBuilder()
      const stretch = new StretchBuilder({ factor: 2 })
      const effects = [rev, stretch]

      const result = partitionEffects(effects)

      expect(result.transforms).toHaveLength(2)
      expect(result.transforms[0]).toBe(rev)
      expect(result.transforms[1]).toBe(stretch)
      expect(result.interceptors).toEqual([])
    })

    it('should preserve order of multiple transforms', () => {
      const t1 = new ReverseBuilder()
      const t2 = new StretchBuilder({ factor: 1 })
      const t3 = new ReverseBuilder()
      const effects = [t1, t2, t3]

      const result = partitionEffects(effects)

      expect(result.transforms).toHaveLength(3)
      expect(result.transforms[0]).toBe(t1)
      expect(result.transforms[1]).toBe(t2)
      expect(result.transforms[2]).toBe(t3)
    })
  })

  // ========================================================================
  // Mixed order preserved
  // ========================================================================

  describe('mixed order preserved', () => {
    it('should partition and preserve order within each group', () => {
      const i1 = step((b) => b)
      const t1 = new ReverseBuilder()
      const i2 = step((b) => b)
      const t2 = new StretchBuilder({ factor: 0.5 })
      const i3 = step((b) => b)
      const effects = [i1, t1, i2, t2, i3]

      const result = partitionEffects(effects)

      expect(result.interceptors).toHaveLength(3)
      expect(result.interceptors[0]).toBe(i1)
      expect(result.interceptors[1]).toBe(i2)
      expect(result.interceptors[2]).toBe(i3)

      expect(result.transforms).toHaveLength(2)
      expect(result.transforms[0]).toBe(t1)
      expect(result.transforms[1]).toBe(t2)
    })

    it('should handle interleaved order: transform, interceptor, transform', () => {
      const t1 = new ReverseBuilder()
      const i = step((b) => b)
      const t2 = new StretchBuilder()
      const effects = [t1, i, t2]

      const result = partitionEffects(effects)

      expect(result.interceptors).toEqual([i])
      expect(result.transforms).toHaveLength(2)
      expect(result.transforms[0]).toBe(t1)
      expect(result.transforms[1]).toBe(t2)
    })

    it('should handle single interceptor then single transform', () => {
      const i = step((b) => b)
      const t = new ReverseBuilder()
      const result = partitionEffects([i, t])

      expect(result.interceptors).toEqual([i])
      expect(result.transforms).toEqual([t])
    })

    it('should handle single transform then single interceptor', () => {
      const t = new StretchBuilder({ factor: 2 })
      const i = step((b) => b)
      const result = partitionEffects([t, i])

      expect(result.interceptors).toEqual([i])
      expect(result.transforms).toEqual([t])
    })
  })
})
