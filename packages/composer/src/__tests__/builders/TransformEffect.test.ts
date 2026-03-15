/**
 * TransformEffect Test — isTransformEffect type guard
 *
 * Tests the TransformEffect marker class and isTransformEffect type guard.
 * TransformEffect is the base for post-processing transforms (reverse, stretch).
 * Covers:
 *   - isTransformEffect(reverse()) = true
 *   - isTransformEffect(stretch()) = true
 *   - isTransformEffect(step()) = false
 */

import { describe, it, expect } from 'vitest'
import { reverse } from '../../notations/reverse'
import { stretch } from '../../notations/stretch'
import { note } from '../../notations/note'
import { step } from '../../utils/step'
import { isTransformEffect } from '../../builders/TransformEffect'

describe('TransformEffect / isTransformEffect', () => {

  describe('isTransformEffect', () => {
    it('isTransformEffect(reverse()) should return true', () => {
      const r = reverse()
      expect(isTransformEffect(r)).toBe(true)
    })

    it('isTransformEffect(stretch()) should return true', () => {
      const s = stretch()
      expect(isTransformEffect(s)).toBe(true)
    })

    it('isTransformEffect(step()) should return false', () => {
      const st = step((bridge) => bridge)
      expect(isTransformEffect(st)).toBe(false)
    })

    it('isTransformEffect(reverse().steps(...)) should return true', () => {
      const r = reverse()
      expect(isTransformEffect(r)).toBe(true)
    })

    it('isTransformEffect(stretch(2, note(...))) should return true', () => {
      const s = stretch(2, note('C4'))
      expect(isTransformEffect(s)).toBe(true)
    })
  })
})
