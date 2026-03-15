/**
 * SwingBuilder & swing() notation test
 *
 * Tests SwingBuilder (returned by `swing()`), a ScopedStepBuilder that wraps
 * the bridge in SwingBridge to apply swing timing.
 *
 * Covers:
 *   - swing().steps(note(...)) produces swung timing (onbeat vs offbeat)
 *   - swing(amount?, grid?) params and defaults
 *   - .amount() and .grid() chaining
 *   - Single note (onbeat) — no offset
 *   - Multiple notes — offbeat notes shifted
 *   - Precise bypass
 *   - Default (cascading) usage without .steps()
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../notations/note'
import { swing } from '../../notations/swing'
import { createBridge, commitAndCapture } from '../test-utils'

describe('SwingBuilder', () => {

  // ========================================================================
  // swing() notation
  // ========================================================================

  describe('swing() notation', () => {
    it('should return SwingBuilder instance', () => {
      expect(swing()).toBeDefined()
      expect(swing().steps).toBeDefined()
      expect(typeof swing().steps).toBe('function')
    })

    it('should accept optional amount and grid params', () => {
      const b1 = swing(0.5, 480)
      const b2 = swing(0, 240)
      const b3 = swing(1.0)

      expect(b1).toBeDefined()
      expect(b2).toBeDefined()
      expect(b3).toBeDefined()
    })
  })

  // ========================================================================
  // swing().steps(note(...)) — swung timing
  // ========================================================================

  describe('swing().steps(note(...))', () => {
    it('should apply swing to inner content — single note at onbeat remains at tick 0', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing().steps(note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].pitch).toBe(60)
    })

    it('should apply swing — two notes produce onbeat (0) then offbeat (600) with default amount 0.5', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing()
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)    // onbeat — no offset
      expect(notes[1].tick).toBe(600) // offbeat: 480 + round(0.5 * 480 * 0.5) = 480 + 120
    })

    it('should produce swung timing for four notes (alternating onbeat/offbeat)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing()
        .steps(note('C4'), note('C4'), note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].tick).toBe(0)    // onbeat
      expect(notes[1].tick).toBe(600)  // offbeat
      expect(notes[2].tick).toBe(1080) // onbeat
      expect(notes[3].tick).toBe(1680) // offbeat
    })

    it('should advance tick correctly after scope exits', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing()
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      expect(result.tick).toBe(1080) // 2 swung notes: second at 600 + 480 duration
    })

    it('should apply swing only to steps inside .steps()', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = swing().steps(note('C4'), note('C4')).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(600)
      expect(notes[2].tick).toBe(1080) // unscoped note at scope end: 600 + 480
    })
  })

  // ========================================================================
  // amount param
  // ========================================================================

  describe('amount param', () => {
    it('amount 0 should apply no offset (straight timing)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing(0)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })

    it('amount 0.5 (triplet swing) should offset offbeat by 120 ticks at grid 480', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing(0.5)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(600) // 480 + 120
    })

    it('amount 1.0 (dotted swing) should offset offbeat by 240 ticks at grid 480', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing(1.0)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(720) // 480 + 240
    })

    it('.amount() chain should override initial param', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing(1.0)
        .amount(0)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(480) // no offset
    })
  })

  // ========================================================================
  // grid param
  // ========================================================================

  describe('grid param', () => {
    it('grid 240 should use half grid — offset = round(0.5 * 240 * 0.5) = 60', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = swing(0.5, 240)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(300) // 240 + 60
    })

    it('.grid() chain should override initial param', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing(0.5, 240)
        .grid(480)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[1].tick).toBe(600) // grid 480 → offset 120
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('note().precise() should skip swing even inside swing scope', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = swing()
        .steps(note('C4').precise(), note('C4').precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480) // no swing offset
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('swing().default().apply() should return bridge that cascades swing downstream', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = swing(0.5).default().apply(bridge)
      b = note('C4').apply(b)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(600) // swing applied downstream
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = swing(0.5)
      const withAmount = base.amount(0)
      const withGrid = base.grid(240)

      expect(base).not.toBe(withAmount)
      expect(base).not.toBe(withGrid)
    })
  })
})
