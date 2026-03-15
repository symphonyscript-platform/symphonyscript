/**
 * QuantizationBridge Test — Bridge Decorator
 *
 * Tests QuantizationBridge, a CompositionBridgeDecorator that snaps note ticks
 * to a grid. Formula: nearest = round(tick/grid)*grid;
 * quantized = round(tick + (nearest-tick)*strength).
 *
 * Covers:
 *   - strength 0: no change (tick unchanged)
 *   - strength 1: full snap to nearest grid point
 *   - partial strength: interpolated quantization
 *   - precise bypass: skips quantization when precise=true
 */

import { describe, it, expect } from 'vitest'
import { QuantizationBridge } from '../../composition/QuantizationBridge'
import { createBridge, commitAndCapture } from '../test-utils'

describe('QuantizationBridge', () => {

  function createQuantizationBridge(grid: number, strength: number, baseOverrides: Parameters<typeof createBridge>[0] = {}) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100, ...baseOverrides })
    return new QuantizationBridge(bridge, { grid, strength })
  }

  // ========================================================================
  // Strength 0 — no change
  // ========================================================================

  describe('strength 0', () => {
    it('should leave tick unchanged when strength is 0', () => {
      const qb = createQuantizationBridge(480, 0)

      // First note at tick 0, duration 240 -> tick advances to 240
      let b = qb.withNote(60, 240)
      // Second note at tick 240 (off-grid). With strength 0, quantized stays 240
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
    })

    it('should preserve off-grid positions at strength 0', () => {
      const qb = createQuantizationBridge(480, 0)

      // First note duration 100 -> tick advances to 100
      let b = qb.withNote(60, 100)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[0].tick).toBe(0)
      // Second note at tick 100. nearest=0, strength 0 -> quantized=100 (unchanged)
      expect(notes[1].tick).toBe(100)
    })
  })

  // ========================================================================
  // Strength 1 — full snap
  // ========================================================================

  describe('strength 1', () => {
    it('should snap to nearest grid point when strength is 1', () => {
      const qb = createQuantizationBridge(480, 1)

      // Note at tick 240 (between 0 and 480). nearest=480, full snap -> 480
      let b = qb.withNote(60, 480)   // first note at 0
      b = b.withNote(60, 480)        // second note at tick 240... no
      // First note: tick 0, quantized 0, duration 480, tick advances to 480
      // Second note: tick 480, already on grid. Let me use different timing.

      // To get tick 240: first note duration 240
      b = createQuantizationBridge(480, 1)
      b = b.withNote(60, 240)       // note at 0, tick -> 240
      b = b.withNote(60, 480)       // note at tick 240, snap to 480
      const { notes } = commitAndCapture(b)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)  // 240 snaps to 480 (nearest)
    })

    it('should snap downward when closer to previous grid', () => {
      const qb = createQuantizationBridge(480, 1)

      // Tick 200: nearest = round(200/480)*480 = 0 (round(0.417)=0)
      // So nearest=0, quantized=0
      let b = qb.withNote(60, 200)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(0)  // 200 snaps to 0
    })

    it('should snap upward when past midpoint', () => {
      const qb = createQuantizationBridge(480, 1)

      // Tick 300: nearest = round(300/480)*480 = round(0.625)*480 = 480
      let b = qb.withNote(60, 300)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(480)  // 300 snaps to 480
    })
  })

  // ========================================================================
  // Partial strength
  // ========================================================================

  describe('partial strength', () => {
    it('should interpolate between original and grid at partial strength', () => {
      const qb = createQuantizationBridge(480, 0.5)

      // Tick 240, nearest 480: quantized = round(240 + (480-240)*0.5) = round(360) = 360
      let b = qb.withNote(60, 240)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(360)
    })

    it('should move less with lower strength', () => {
      const qb = createQuantizationBridge(480, 0.25)

      // Tick 240, nearest 480: quantized = round(240 + 240*0.25) = round(300) = 300
      let b = qb.withNote(60, 240)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(300)
    })

    it('should move more with higher partial strength', () => {
      const qb = createQuantizationBridge(480, 0.75)

      // Tick 240, nearest 480: quantized = round(240 + 240*0.75) = round(420) = 420
      let b = qb.withNote(60, 240)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(420)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip quantization when precise flag is set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const qb = new QuantizationBridge(bridge, { grid: 480, strength: 1 })

      // Even with strength 1, precise should bypass quantization
      let b = qb.withNote(60, 240)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      // Without bypass, tick 240 would snap to 480. With bypass, stays 240
      expect(notes[1].tick).toBe(240)
    })

    it('should preserve pitch and velocity when bypassed', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const qb = new QuantizationBridge(bridge, { grid: 480, strength: 1 })

      const result = qb.withNote(64, 320, 90)
      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(64)
      expect(notes[0].velocity).toBe(90)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Grid variations
  // ========================================================================

  describe('grid size', () => {
    it('should respect different grid sizes', () => {
      const qb = createQuantizationBridge(240, 1)

      // Tick 100: nearest = round(100/240)*240 = 0
      let b = qb.withNote(60, 100)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(0)

      // Tick 150: nearest = round(150/240)*240 = 240
      const qb2 = createQuantizationBridge(240, 1)
      let b2 = qb2.withNote(60, 150)
      b2 = b2.withNote(60, 480)
      const { notes: n2 } = commitAndCapture(b2)
      expect(n2[1].tick).toBe(240)
    })
  })
})
