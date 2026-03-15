/**
 * QuantizationBuilder Test — quantize() and QuantizationBuilder
 *
 * Tests the QuantizationBuilder (returned by `quantize(grid?, strength?)`), a
 * ScopedStepBuilder that snaps note ticks to a grid.
 *
 * Covers:
 *   - quantize(grid?, strength?) returns QuantizationBuilder
 *   - quantize(480, 1).steps(note('C4')) snaps tick to grid
 *   - strength 1: full snap to nearest grid point
 *   - strength 0: no change (original tick preserved)
 *   - grid param: different grid sizes
 *   - .grid() and .strength() chaining
 *   - Scoped usage vs default (cascading)
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../notations/note'
import { quantize } from '../../notations/quantize'
import { createBridge, commitAndCapture } from '../test-utils'
import { QuantizationBuilder } from '../../builders/QuantizationBuilder'

describe('QuantizationBuilder', () => {

  // ========================================================================
  // quantize() returns QuantizationBuilder
  // ========================================================================

  describe('quantize() factory', () => {
    it('quantize() should return QuantizationBuilder', () => {
      const q = quantize()
      expect(q).toBeInstanceOf(QuantizationBuilder)
    })

    it('quantize(480) should return QuantizationBuilder', () => {
      const q = quantize(480)
      expect(q).toBeInstanceOf(QuantizationBuilder)
    })

    it('quantize(480, 1) should return QuantizationBuilder', () => {
      const q = quantize(480, 1)
      expect(q).toBeInstanceOf(QuantizationBuilder)
    })

    it('quantize(480, 1).steps(note("C4")) should be chainable and applyable', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = quantize(480, 1).steps(note('C4')).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })
  })

  // ========================================================================
  // strength 1 — snaps tick to grid
  // ========================================================================

  describe('strength 1', () => {
    it('quantize(480, 1).steps(note(...), note(...)) should snap second note to grid', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      // First note duration 240 → tick advances to 240
      // Second note at tick 240; nearest grid = 480; strength 1 → snaps to 480
      const result = quantize(480, 1)
        .steps(
          note('C4').duration(240),
          note('C4').duration(480),
        )
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480) // 240 snapped to 480
    })

    it('should snap downward when closer to previous grid', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      // Tick 200: nearest = round(200/480)*480 = 0
      const result = quantize(480, 1)
        .steps(note('C4').duration(200), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(0)
    })

    it('should snap upward when past midpoint', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      // Tick 300: nearest = round(300/480)*480 = 480
      const result = quantize(480, 1)
        .steps(note('C4').duration(300), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(480)
    })
  })

  // ========================================================================
  // strength 0 — no change
  // ========================================================================

  describe('strength 0', () => {
    it('strength 0 should leave tick unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = quantize(480, 0)
        .steps(note('C4').duration(240), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240) // no snap
    })

    it('should preserve off-grid positions at strength 0', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = quantize(480, 0)
        .steps(note('C4').duration(100), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(100)
    })
  })

  // ========================================================================
  // grid param
  // ========================================================================

  describe('grid param', () => {
    it('should respect different grid sizes', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      // Grid 240: tick 100 → nearest 0, snap to 0
      const result1 = quantize(240, 1)
        .steps(note('C4').duration(100), note('C4'))
        .apply(bridge)
      const { notes: n1 } = commitAndCapture(result1)
      expect(n1[1].tick).toBe(0)

      // Grid 240: tick 150 → nearest 240, snap to 240
      const bridge2 = createBridge({ defaultDuration: 480 })
      const result2 = quantize(240, 1)
        .steps(note('C4').duration(150), note('C4'))
        .apply(bridge2)
      const { notes: n2 } = commitAndCapture(result2)
      expect(n2[1].tick).toBe(240)
    })

    it('.grid() should override initial grid', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = quantize(480, 1)
        .grid(240)
        .steps(note('C4').duration(150), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(240)
    })
  })

  // ========================================================================
  // .strength() chaining
  // ========================================================================

  describe('chaining', () => {
    it('.strength() should override initial strength', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = quantize(480, 1)
        .strength(0)
        .steps(note('C4').duration(240), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(240) // strength 0 = no snap
    })

    it('.grid().strength().steps() should chain correctly', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = quantize()
        .grid(240)
        .strength(1)
        .steps(note('C4').duration(100), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(0)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('should return modified bridge when used without .steps()', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const modified = quantize(480, 1).apply(bridge)
      // Bridge is now wrapped with QuantizationBridge — downstream notes get quantized
      const result = note('C4').duration(240).apply(modified)
      const result2 = note('C4').apply(result)

      const { notes } = commitAndCapture(result2)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480) // tick 240 snaps to 480
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = quantize(480, 1)
      const withGrid = base.grid(240)
      const withStrength = base.strength(0)

      expect(base).not.toBe(withGrid)
      expect(base).not.toBe(withStrength)
    })
  })
})
