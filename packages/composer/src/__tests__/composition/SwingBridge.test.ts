/**
 * SwingBridge Test — Bridge Decorator
 *
 * Tests SwingBridge, a CompositionBridgeDecorator that applies swing timing.
 * SwingBridge applies a timing offset to offbeat notes (second half of a two-beat
 * cycle) based on the amount parameter.
 *
 * Covers:
 *   - Onbeat: no timing offset, note at original tick
 *   - Offbeat: tick offset = round(amount * grid * 0.5)
 *   - Different amounts (0, 0.5, 1.0) and verified offset values
 *   - Two consecutive notes crossing onbeat/offbeat boundary
 *   - Precise bypass: when bridge has precise=true, swing is skipped
 *   - rewrap returns SwingBridge instance
 */

import { describe, it, expect } from 'vitest'
import { SwingBridge } from '../../composition/SwingBridge'
import { createBridge, commitAndCapture } from '../test-utils'

describe('SwingBridge', () => {

  function createSwingBridge(amount: number, grid: number = 480) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new SwingBridge(bridge, { amount, grid })
  }

  // ========================================================================
  // Onbeat (position < grid)
  // ========================================================================

  describe('onbeat', () => {
    it('should not offset note tick when position < grid', () => {
      const sb = createSwingBridge(0.5, 480)

      // tick 0: position = 0, isOffbeat = false → no offset
      const result = sb.withNote(60, 480)
      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
    })

    it('should not offset at tick 0 with any amount', () => {
      const sb = createSwingBridge(1.0, 480)

      const result = sb.withNote(60, 480)
      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Offbeat (position >= grid)
  // ========================================================================

  describe('offbeat', () => {
    it('should offset note tick when position >= grid', () => {
      const sb = createSwingBridge(0.5, 480)

      // tick 480: position = 480, isOffbeat = true → offset = round(0.5 * 480 * 0.5) = 120
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(600) // 480 + 120
    })

    it('should apply offset = round(amount * grid * 0.5) for amount 0.5', () => {
      const sb = createSwingBridge(0.5, 480)

      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      // offset = round(0.5 * 480 * 0.5) = 120
      expect(notes[1].tick).toBe(480 + 120)
    })

    it('should apply offset = round(amount * grid * 0.5) for amount 1.0', () => {
      const sb = createSwingBridge(1.0, 480)

      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      // offset = round(1.0 * 480 * 0.5) = 240
      expect(notes[1].tick).toBe(480 + 240)
    })

    it('should apply zero offset when amount is 0', () => {
      const sb = createSwingBridge(0, 480)

      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(480)
    })
  })

  // ========================================================================
  // Different amounts
  // ========================================================================

  describe('amount variations', () => {
    it('should verify offset for amount 0', () => {
      const sb = createSwingBridge(0, 480)
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(480)
    })

    it('should verify offset for amount 0.5 at grid 480', () => {
      const sb = createSwingBridge(0.5, 480)
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(600) // 480 + 120
    })

    it('should verify offset for amount 1.0 at grid 480', () => {
      const sb = createSwingBridge(1.0, 480)
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)
      const { notes } = commitAndCapture(b)
      expect(notes[1].tick).toBe(720) // 480 + 240
    })
  })

  // ========================================================================
  // Two consecutive notes crossing onbeat/offbeat boundary
  // ========================================================================

  describe('onbeat/offbeat boundary', () => {
    it('should handle two consecutive notes crossing boundary', () => {
      const sb = createSwingBridge(0.5, 480)

      // Note 1: tick 0 (onbeat) → no offset, emitted at 0
      // Note 2: tick 480 (offbeat) → offset 120, emitted at 600
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(600)
    })

    it('should alternate onbeat/offbeat over four notes', () => {
      const sb = createSwingBridge(0.5, 480)

      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)
      b = b.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[0].tick).toBe(0)    // onbeat at tick 0
      expect(notes[1].tick).toBe(600)  // offbeat (480 + 120)
      expect(notes[2].tick).toBe(1080) // onbeat at tick 1080 (position 120 in cycle)
      expect(notes[3].tick).toBe(1680) // offbeat (1560 + 120)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip swing when precise flag is set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const sb = new SwingBridge(bridge, { amount: 0.5, grid: 480 })

      // Even at offbeat position, swing should be bypassed
      let b = sb.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480) // no offset, original tick
    })
  })

  // ========================================================================
  // rewrap returns SwingBridge
  // ========================================================================

  describe('rewrap', () => {
    it('should return SwingBridge instance from withNote', () => {
      const sb = createSwingBridge(0.5, 480)

      const result = sb.withNote(60, 480)

      expect(result).toBeInstanceOf(SwingBridge)
    })
  })
})
