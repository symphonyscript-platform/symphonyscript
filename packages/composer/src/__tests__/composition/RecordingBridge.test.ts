/**
 * RecordingBridge Test — ExecutionContext Capture
 *
 * RecordingBridge implements ExecutionContext and captures events into arrays.
 * Used by freeze() and transforms. toFrozenClip() returns IFrozenClip from
 * captured notes, CC events, and bend events.
 *
 * Covers:
 *   - Notes capture via insertNote / toFrozenClip / visitNotes
 *   - CC capture via insertCC / toFrozenClip / visitCC
 *   - Bends capture via insertBend / toFrozenClip / visitBends
 *   - getPpq returns 480
 */

import { describe, it, expect } from 'vitest'
import { RecordingBridge } from '../../composition/RecordingBridge'

describe('RecordingBridge', () => {

  // ========================================================================
  // Notes capture
  // ========================================================================

  describe('notes capture', () => {
    it('should capture a single note and return it via visitNotes', () => {
      const bridge = new RecordingBridge()
      bridge.insertNote(60, 100, 480, 0, false, 1)

      const frozen = bridge.toFrozenClip()
      const notes: Array<{ sourceId: number; pitch: number; velocity: number; duration: number; tick: number; muted: boolean }> = []
      frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
        notes.push({ sourceId, pitch, velocity, duration, tick, muted })
      })

      expect(notes).toHaveLength(1)
      expect(notes[0]).toEqual({
        sourceId: 1,
        pitch: 60,
        velocity: 100,
        duration: 480,
        tick: 0,
        muted: false,
      })
    })

    it('should capture multiple notes in insertion order', () => {
      const bridge = new RecordingBridge()
      bridge.insertNote(60, 100, 480, 0, false, 1)
      bridge.insertNote(64, 80, 240, 480, false, 2)
      bridge.insertNote(67, 120, 960, 720, true, 3)

      const frozen = bridge.toFrozenClip()
      const notes: Array<{ sourceId: number; pitch: number; velocity: number; duration: number; tick: number; muted: boolean }> = []
      frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
        notes.push({ sourceId, pitch, velocity, duration, tick, muted })
      })

      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 60, velocity: 100, duration: 480, tick: 0, muted: false, sourceId: 1 })
      expect(notes[1]).toMatchObject({ pitch: 64, velocity: 80, duration: 240, tick: 480, muted: false, sourceId: 2 })
      expect(notes[2]).toMatchObject({ pitch: 67, velocity: 120, duration: 960, tick: 720, muted: true, sourceId: 3 })
    })

    it('should return note index from insertNote', () => {
      const bridge = new RecordingBridge()
      const idx0 = bridge.insertNote(60, 100, 480, 0, false, 1)
      const idx1 = bridge.insertNote(64, 80, 240, 480, false, 2)

      expect(idx0).toBe(0)
      expect(idx1).toBe(1)
    })
  })

  // ========================================================================
  // CC capture
  // ========================================================================

  describe('CC capture', () => {
    it('should capture a single CC event and return it via visitCC', () => {
      const bridge = new RecordingBridge()
      bridge.insertCC(7, 100, 0, 1)

      const frozen = bridge.toFrozenClip()
      const cc: Array<{ sourceId: number; controller: number; value: number; tick: number }> = []
      frozen.visitCC((sourceId, controller, value, tick) => {
        cc.push({ sourceId, controller, value, tick })
      })

      expect(cc).toHaveLength(1)
      expect(cc[0]).toEqual({
        sourceId: 1,
        controller: 7,
        value: 100,
        tick: 0,
      })
    })

    it('should capture multiple CC events in insertion order', () => {
      const bridge = new RecordingBridge()
      bridge.insertCC(7, 80, 0, 1)
      bridge.insertCC(10, 64, 480, 2)
      bridge.insertCC(11, 127, 960, 3)

      const frozen = bridge.toFrozenClip()
      const cc: Array<{ sourceId: number; controller: number; value: number; tick: number }> = []
      frozen.visitCC((sourceId, controller, value, tick) => {
        cc.push({ sourceId, controller, value, tick })
      })

      expect(cc).toHaveLength(3)
      expect(cc[0]).toEqual({ sourceId: 1, controller: 7, value: 80, tick: 0 })
      expect(cc[1]).toEqual({ sourceId: 2, controller: 10, value: 64, tick: 480 })
      expect(cc[2]).toEqual({ sourceId: 3, controller: 11, value: 127, tick: 960 })
    })

    it('should return CC index from insertCC', () => {
      const bridge = new RecordingBridge()
      const idx0 = bridge.insertCC(7, 100, 0, 1)
      const idx1 = bridge.insertCC(10, 64, 480, 2)

      expect(idx0).toBe(0)
      expect(idx1).toBe(1)
    })
  })

  // ========================================================================
  // Bends capture
  // ========================================================================

  describe('bends capture', () => {
    it('should capture a single bend event and return it via visitBends', () => {
      const bridge = new RecordingBridge()
      bridge.insertBend(8192, 0, 1)

      const frozen = bridge.toFrozenClip()
      const bends: Array<{ sourceId: number; value: number; tick: number }> = []
      frozen.visitBends((sourceId, value, tick) => {
        bends.push({ sourceId, value, tick })
      })

      expect(bends).toHaveLength(1)
      expect(bends[0]).toEqual({
        sourceId: 1,
        value: 8192,
        tick: 0,
      })
    })

    it('should capture multiple bend events in insertion order', () => {
      const bridge = new RecordingBridge()
      bridge.insertBend(0, 0, 1)
      bridge.insertBend(8192, 480, 2)
      bridge.insertBend(16383, 960, 3)

      const frozen = bridge.toFrozenClip()
      const bends: Array<{ sourceId: number; value: number; tick: number }> = []
      frozen.visitBends((sourceId, value, tick) => {
        bends.push({ sourceId, value, tick })
      })

      expect(bends).toHaveLength(3)
      expect(bends[0]).toEqual({ sourceId: 1, value: 0, tick: 0 })
      expect(bends[1]).toEqual({ sourceId: 2, value: 8192, tick: 480 })
      expect(bends[2]).toEqual({ sourceId: 3, value: 16383, tick: 960 })
    })

    it('should return bend index from insertBend', () => {
      const bridge = new RecordingBridge()
      const idx0 = bridge.insertBend(8192, 0, 1)
      const idx1 = bridge.insertBend(0, 480, 2)

      expect(idx0).toBe(0)
      expect(idx1).toBe(1)
    })
  })

  // ========================================================================
  // getPpq
  // ========================================================================

  describe('getPpq', () => {
    it('should return 480', () => {
      const bridge = new RecordingBridge()
      expect(bridge.getPpq()).toBe(480)
    })
  })

  // ========================================================================
  // Mixed capture (notes + CC + bends)
  // ========================================================================

  describe('mixed capture', () => {
    it('should capture notes, CC, and bends together in toFrozenClip', () => {
      const bridge = new RecordingBridge()
      bridge.insertNote(60, 100, 480, 0, false, 1)
      bridge.insertCC(7, 80, 0, 2)
      bridge.insertBend(8192, 240, 3)

      const frozen = bridge.toFrozenClip()

      const notes: Array<{ sourceId: number; pitch: number }> = []
      frozen.visitNotes((sourceId, pitch) => {
        notes.push({ sourceId, pitch })
      })

      const cc: Array<{ sourceId: number; controller: number; value: number }> = []
      frozen.visitCC((sourceId, controller, value) => {
        cc.push({ sourceId, controller, value })
      })

      const bends: Array<{ sourceId: number; value: number }> = []
      frozen.visitBends((sourceId, value) => {
        bends.push({ sourceId, value })
      })

      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ sourceId: 1, pitch: 60 })

      expect(cc).toHaveLength(1)
      expect(cc[0]).toMatchObject({ sourceId: 2, controller: 7, value: 80 })

      expect(bends).toHaveLength(1)
      expect(bends[0]).toMatchObject({ sourceId: 3, value: 8192 })
    })
  })
})
