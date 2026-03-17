/**
 * BaseCompositionBridge Test — Core Bridge
 *
 * Tests BaseCompositionBridge, the core bridge that accumulates thunks and
 * commits them to an ExecutionContext (e.g. RecordingBridge).
 *
 * Covers:
 *   - Default params: tick, velocity, defaultDuration, transposeCents
 *   - withNote emits notes with correct pitch, velocity, duration, tick, muted
 *   - withTick, withVelocity, withTransposeCents
 *   - Cents-only scale/key: withScaleRootCents, withScaleIntervals, withKeyRootCents
 *   - commit to RecordingBridge via commitAndCapture
 */

import { describe, it, expect } from 'vitest'
import { createBridge, commitAndCapture } from '../test-utils'

describe('BaseCompositionBridge', () => {

  // ========================================================================
  // Default params
  // ========================================================================

  describe('default params', () => {
    it('should have default tick=0, velocity=800, defaultDuration=1, transposeCents=0', () => {
      const bridge = createBridge()

      expect(bridge.tick).toBe(0)
      expect(bridge.velocity).toBe(800)
      expect(bridge.defaultDuration).toBe(1)
      expect(bridge.transposeCents).toBe(0)
    })

    it('should accept partial overrides in constructor', () => {
      const bridge = createBridge({
        tick: 100,
        velocity: 600,
        defaultDuration: 2,
        transposeCents: 1200,
      })

      expect(bridge.tick).toBe(100)
      expect(bridge.velocity).toBe(600)
      expect(bridge.defaultDuration).toBe(2)
      expect(bridge.transposeCents).toBe(1200)
    })

    it('should have default scaleRootCents=0, keyRootCents=null, scaleIntervals=null', () => {
      const bridge = createBridge()

      expect(bridge.scaleRootCents).toBe(0)
      expect(bridge.keyRootCents).toBeNull()
      expect(bridge.scaleIntervals).toBeNull()
    })
  })

  // ========================================================================
  // withNote emits
  // ========================================================================

  describe('withNote', () => {
    it('should emit a note with pitch, velocity, duration, tick, and muted', () => {
      const bridge = createBridge({ velocity: 100, defaultDuration: 480 })
      const result = bridge.withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].velocity).toBe(100)
      expect(notes[0].duration).toBe(480)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].muted).toBe(false)
    })

    it('should use defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = bridge.withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
    })

    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = bridge.withNote(6000, 960)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(960)
    })

    it('should use explicit velocity when provided', () => {
      const bridge = createBridge({ velocity: 100 })
      const result = bridge.withNote(6000, 480, 127)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(127)
    })

    it('should apply transposeCents to pitch', () => {
      const bridge = createBridge({ transposeCents: 1200 })
      const result = bridge.withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(7200) // 6000 + 1200
    })

    it('should emit muted notes when muted=true', () => {
      const bridge = createBridge({ muted: true })
      const result = bridge.withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].muted).toBe(true)
    })

    it('should advance tick after each note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = bridge.withNote(6000)
      b = b.withNote(6400)
      b = b.withNote(6700)
      const { notes } = commitAndCapture(b)

      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
      expect(notes[2].tick).toBe(960)
    })
  })

  // ========================================================================
  // withTick
  // ========================================================================

  describe('withTick', () => {
    it('should set tick for subsequent notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = bridge.withTick(960).withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].tick).toBe(960)
    })

    it('should advance from the new tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = bridge.withTick(480).withNote(6000)
      b = b.withNote(6400)
      const { notes } = commitAndCapture(b)

      expect(notes[0].tick).toBe(480)
      expect(notes[1].tick).toBe(960)
    })
  })

  // ========================================================================
  // withVelocity
  // ========================================================================

  describe('withVelocity', () => {
    it('should set velocity for subsequent notes', () => {
      const bridge = createBridge({ velocity: 100 })
      const result = bridge.withVelocity(64).withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(64)
    })

    it('should allow chaining and override', () => {
      const bridge = createBridge({ velocity: 100 })
      let b = bridge.withVelocity(64).withNote(6000)
      b = b.withVelocity(127).withNote(6400)
      const { notes } = commitAndCapture(b)

      expect(notes[0].velocity).toBe(64)
      expect(notes[1].velocity).toBe(127)
    })
  })

  // ========================================================================
  // withTransposeCents
  // ========================================================================

  describe('withTransposeCents', () => {
    it('should add transpose in cents to pitch for subsequent notes', () => {
      const bridge = createBridge()
      const result = bridge.withTransposeCents(700).withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(6700) // 6000 + 700
    })

    it('should allow negative transpose', () => {
      const bridge = createBridge()
      const result = bridge.withTransposeCents(-1200).withNote(7200)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(6000) // 7200 - 1200
    })
  })

  // ========================================================================
  // withScaleRootCents / withScaleIntervals / withKeyRootCents
  // ========================================================================

  describe('cents-only scale/key context', () => {
    it('should set scaleRootCents', () => {
      const bridge = createBridge()
      const result = bridge.withScaleRootCents(700)

      expect(result.scaleRootCents).toBe(700)
    })

    it('should set scaleIntervals', () => {
      const intervals = [0, 200, 400, 500, 700, 900, 1100]
      const bridge = createBridge()
      const result = bridge.withScaleIntervals(intervals)

      expect(result.scaleIntervals).toBe(intervals)
    })

    it('should set keyRootCents', () => {
      const bridge = createBridge()
      const result = bridge.withKeyRootCents(900)

      expect(result.keyRootCents).toBe(900)
    })

    it('should preserve scale/key when emitting notes', () => {
      const intervals = [0, 200, 400, 500, 700, 900, 1100]
      const bridge = createBridge()
      const result = bridge
        .withScaleRootCents(200)
        .withScaleIntervals(intervals)
        .withNote(6000)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(result.scaleRootCents).toBe(200)
      expect(result.scaleIntervals).toBe(intervals)
    })
  })

  // ========================================================================
  // commit to RecordingBridge
  // ========================================================================

  describe('commit', () => {
    it('should commit notes to RecordingBridge via commitAndCapture', () => {
      const bridge = createBridge({ velocity: 100, defaultDuration: 480 })
      let b = bridge.withNote(6000)
      b = b.withNote(6400)
      b = b.withNote(6700)

      const { notes } = commitAndCapture(b)

      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 6000, velocity: 100, duration: 480, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6400, velocity: 100, duration: 480, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 6700, velocity: 100, duration: 480, tick: 960 })
    })

    it('should commit CC events when using withCC', () => {
      const bridge = createBridge()
      const result = bridge.withCC(7, 100)
      const { cc } = commitAndCapture(result)

      expect(cc).toHaveLength(1)
      expect(cc[0]).toMatchObject({ controller: 7, value: 100, tick: 0 })
    })

    it('should commit bend events when using withBend', () => {
      const bridge = createBridge()
      const result = bridge.withBend(8192)
      const { bends } = commitAndCapture(result)

      expect(bends).toHaveLength(1)
      expect(bends[0]).toMatchObject({ value: 8192, tick: 0 })
    })

    it('should commit mixed notes, CC, and bends in correct order', () => {
      const bridge = createBridge({ velocity: 64, defaultDuration: 480 })
      let b = bridge.withNote(6000)
      b = b.withCC(10, 64)
      b = b.withNote(6400)
      b = b.withBend(8192)

      const { notes, cc, bends } = commitAndCapture(b)

      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 480 })

      expect(cc).toHaveLength(1)
      expect(cc[0]).toMatchObject({ controller: 10, value: 64, tick: 480 })

      expect(bends).toHaveLength(1)
      expect(bends[0]).toMatchObject({ value: 8192, tick: 960 })
    })
  })
})
