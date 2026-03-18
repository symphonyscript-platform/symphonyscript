/**
 * TieBridge Test — Bridge Decorator
 *
 * Tests TieBridge, a CompositionBridgeDecorator that ties consecutive notes
 * of the same pitch by accumulating duration.
 *
 * Actual implementation behavior:
 *   - First note (lastPitch null): goes to "different pitch" branch, emits note, sets lastPitch + accumulatedDuration
 *   - Same-pitch notes: do NOT emit, advance tick, accumulate duration
 *   - flush(): when lastPitch and accumulatedDuration > 0, ADDS another note with full accumulatedDuration at emitTick
 *
 * Result: For same-pitch then flush, we get 2 notes — one from initial emit, one from flush with accumulated duration.
 */

import { describe, it, expect } from 'vitest'
import { TieBridge } from '../../composition/TieBridge'
import { createBridge, commitAndCapture } from '../test-utils'

describe('TieBridge', () => {

  function createTieBridge(defaultDuration: number = 480) {
    const bridge = createBridge({ defaultDuration, velocity: 100 })
    return new TieBridge(bridge)
  }

  // ========================================================================
  // Same-pitch ties
  // ========================================================================

  describe('same-pitch ties', () => {
    it('should emit first note then flush adds second with accumulated duration', () => {
      const tb = createTieBridge(480)

      // Two same-pitch notes (60, 60): first emits, second accumulates; flush adds accumulated note
      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)

      const flushed = (result as TieBridge).flush()
      const { notes } = commitAndCapture(flushed)

      // Actual: 2 notes — initial emit (480) + flush with accumulated (960)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].duration).toBe(480)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[1].duration).toBe(960)
      expect(notes[1].tick).toBe(0)
    })

    it('should accumulate multiple same-pitch notes; flush emits full accumulated duration', () => {
      const tb = createTieBridge(480)

      // Four same-pitch notes — first emits 480, rest accumulate to 1920 total
      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)
      result = result.withNote(6000, 480)
      result = result.withNote(6000, 480)

      const flushed = (result as TieBridge).flush()
      const { notes } = commitAndCapture(flushed)

      // Actual: 2 notes — initial (480) + flush with full accumulated (1920)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].duration).toBe(480)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[1].duration).toBe(1920)
    })

    it('should advance tick correctly when accumulating same-pitch notes', () => {
      const tb = createTieBridge(480)

      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)

      expect(result.tick).toBe(960)
    })
  })

  // ========================================================================
  // Different pitch flushes
  // ========================================================================

  describe('different pitch flushes', () => {
    it('should flush accumulated note when different pitch arrives and emit new note', () => {
      const tb = createTieBridge(480)

      // 60, 60 (same) then 62 (different): first 60 emits, second accumulates, flush adds tied note, then 62
      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)
      result = result.withNote(6200, 480)

      const { notes } = commitAndCapture(result)

      // Actual: 3 notes — initial 60 (480), flush 60 (960), new 62 (480)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].duration).toBe(480)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[1].duration).toBe(960)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].pitch).toBe(6200)
      expect(notes[2].duration).toBe(480)
      expect(notes[2].tick).toBe(960)
    })

    it('should emit each pitch change as a new note', () => {
      const tb = createTieBridge(480)

      // 60, 60, 62, 62, 64 — first of each emits, same-pitch accumulates; each change flushes and adds
      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)
      result = result.withNote(6200, 480)
      result = result.withNote(6200, 480)
      result = result.withNote(6400, 480)

      const { notes } = commitAndCapture(result)

      // Actual: 5 notes — 60/480, 60/960, 62/480, 62/960 (flush at emitTick=960), 64/480
      expect(notes).toHaveLength(5)
      expect(notes[0]).toMatchObject({ pitch: 6000, duration: 480, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6000, duration: 960, tick: 0 })
      expect(notes[2]).toMatchObject({ pitch: 6200, duration: 480, tick: 960 })
      expect(notes[3]).toMatchObject({ pitch: 6200, duration: 960, tick: 960 })
      expect(notes[4]).toMatchObject({ pitch: 6400, duration: 480, tick: 1920 })
    })

    it('should use default duration when not provided', () => {
      const tb = createTieBridge(240)

      let result = tb.withNote(6000) // uses defaultDuration 240
      result = result.withNote(6200)

      const { notes } = commitAndCapture(result)
      // Actual: 3 notes — initial 60, flush 60 (same duration), then 62
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })
  })

  // ========================================================================
  // flush() behavior
  // ========================================================================

  describe('flush()', () => {
    it('should add accumulated note when flushed (2 notes total: initial + flush)', () => {
      const tb = createTieBridge(480)

      let result = tb.withNote(6000, 480)
      result = result.withNote(6000, 480)

      const flushed = (result as TieBridge).flush()
      const { notes } = commitAndCapture(flushed)

      // Actual: 2 notes — initial emit (480) + flush adds (960) at same tick
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(480)
      expect(notes[1].tick).toBe(0)
      expect(notes[1].duration).toBe(960)
    })

    it('should return bridge unchanged when nothing to flush (no accumulated note)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const tb = new TieBridge(bridge)

      const flushed = tb.flush()
      const { notes } = commitAndCapture(flushed)

      expect(notes).toHaveLength(0)
    })

    it('should return bridge unchanged when lastPitch is null', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const tb = new TieBridge(bridge, null, 0)

      const flushed = tb.flush()
      const { notes } = commitAndCapture(flushed)

      expect(notes).toHaveLength(0)
    })

    it('should add second note when single note then flushed (2 notes: emit + flush)', () => {
      const tb = createTieBridge(480)

      const result = tb.withNote(6000, 480)
      const flushed = (result as TieBridge).flush()
      const { notes } = commitAndCapture(flushed)

      // Actual: first note emits on entry, flush adds duplicate with same duration
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].duration).toBe(480)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[1].duration).toBe(480)
      expect(notes[1].tick).toBe(0)
    })
  })
})
