/**
 * BaseCompositionBridge Test — Core Bridge
 *
 * Tests BaseCompositionBridge, the core bridge that accumulates thunks and
 * commits them to an ExecutionContext (e.g. RecordingBridge).
 *
 * Covers:
 *   - Default params: tick, velocity, defaultDuration, transpose
 *   - withNote emits notes with correct pitch, velocity, duration, tick, muted
 *   - withTick, withVelocity, withTranspose, withScale, withKey
 *   - commit to RecordingBridge via commitAndCapture
 */

import { describe, it, expect } from 'vitest'
import { PitchClass, ScaleMode } from '@symphonyscript/notations'
import { createBridge, commitAndCapture } from '../test-utils'

describe('BaseCompositionBridge', () => {

  // ========================================================================
  // Default params
  // ========================================================================

  describe('default params', () => {
    it('should have default tick=0, velocity=800, defaultDuration=1, transpose=0', () => {
      const bridge = createBridge()

      expect(bridge.tick).toBe(0)
      expect(bridge.velocity).toBe(800)
      expect(bridge.defaultDuration).toBe(1)
      expect(bridge.transpose).toBe(0)
    })

    it('should accept partial overrides in constructor', () => {
      const bridge = createBridge({
        tick: 100,
        velocity: 600,
        defaultDuration: 2,
        transpose: 12,
      })

      expect(bridge.tick).toBe(100)
      expect(bridge.velocity).toBe(600)
      expect(bridge.defaultDuration).toBe(2)
      expect(bridge.transpose).toBe(12)
    })

    it('should have default scaleRoot=0, scaleMode=MAJOR, keyRoot=null, keyMode=MAJOR', () => {
      const bridge = createBridge()

      expect(bridge.scaleRoot).toBe(0)
      expect(bridge.scaleMode).toBe(ScaleMode.MAJOR)
      expect(bridge.keyRoot).toBeNull()
      expect(bridge.keyMode).toBe(ScaleMode.MAJOR)
    })
  })

  // ========================================================================
  // withNote emits
  // ========================================================================

  describe('withNote', () => {
    it('should emit a note with pitch, velocity, duration, tick, and muted', () => {
      const bridge = createBridge({ velocity: 100, defaultDuration: 480 })
      const result = bridge.withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(notes[0].velocity).toBe(100)
      expect(notes[0].duration).toBe(480)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].muted).toBe(false)
    })

    it('should use defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = bridge.withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
    })

    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = bridge.withNote(60, 960)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(960)
    })

    it('should use explicit velocity when provided', () => {
      const bridge = createBridge({ velocity: 100 })
      const result = bridge.withNote(60, 480, 127)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(127)
    })

    it('should apply transpose to pitch', () => {
      const bridge = createBridge({ transpose: 12 })
      const result = bridge.withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(72)
    })

    it('should emit muted notes when muted=true', () => {
      const bridge = createBridge({ muted: true })
      const result = bridge.withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].muted).toBe(true)
    })

    it('should advance tick after each note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = bridge.withNote(60)
      b = b.withNote(64)
      b = b.withNote(67)
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
      const result = bridge.withTick(960).withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].tick).toBe(960)
    })

    it('should advance from the new tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = bridge.withTick(480).withNote(60)
      b = b.withNote(64)
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
      const result = bridge.withVelocity(64).withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(64)
    })

    it('should allow chaining and override', () => {
      const bridge = createBridge({ velocity: 100 })
      let b = bridge.withVelocity(64).withNote(60)
      b = b.withVelocity(127).withNote(64)
      const { notes } = commitAndCapture(b)

      expect(notes[0].velocity).toBe(64)
      expect(notes[1].velocity).toBe(127)
    })
  })

  // ========================================================================
  // withTranspose
  // ========================================================================

  describe('withTranspose', () => {
    it('should add transpose to pitch for subsequent notes', () => {
      const bridge = createBridge()
      const result = bridge.withTranspose(7).withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(67)
    })

    it('should allow negative transpose', () => {
      const bridge = createBridge()
      const result = bridge.withTranspose(-12).withNote(72)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(60)
    })
  })

  // ========================================================================
  // withScale
  // ========================================================================

  describe('withScale', () => {
    it('should set scaleRoot and scaleMode', () => {
      const bridge = createBridge()
      const result = bridge.withScale(PitchClass.G, ScaleMode.MINOR)

      expect(result.scaleRoot).toBe(PitchClass.G)
      expect(result.scaleMode).toBe(ScaleMode.MINOR)
    })

    it('should preserve scale when emitting notes', () => {
      const bridge = createBridge()
      const result = bridge.withScale(PitchClass.D, ScaleMode.DORIAN).withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })
  })

  // ========================================================================
  // withKey
  // ========================================================================

  describe('withKey', () => {
    it('should set keyRoot and keyMode', () => {
      const bridge = createBridge()
      const result = bridge.withKey(PitchClass.A, ScaleMode.MINOR)

      expect(result.keyRoot).toBe(PitchClass.A)
      expect(result.keyMode).toBe(ScaleMode.MINOR)
    })

    it('should preserve key when emitting notes', () => {
      const bridge = createBridge()
      const result = bridge.withKey(PitchClass.F, ScaleMode.MAJOR).withNote(60)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })
  })

  // ========================================================================
  // commit to RecordingBridge
  // ========================================================================

  describe('commit', () => {
    it('should commit notes to RecordingBridge via commitAndCapture', () => {
      const bridge = createBridge({ velocity: 100, defaultDuration: 480 })
      let b = bridge.withNote(60)
      b = b.withNote(64)
      b = b.withNote(67)

      const { notes } = commitAndCapture(b)

      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 60, velocity: 100, duration: 480, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 64, velocity: 100, duration: 480, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 67, velocity: 100, duration: 480, tick: 960 })
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
      let b = bridge.withNote(60)
      b = b.withCC(10, 64)
      b = b.withNote(64)
      b = b.withBend(8192)

      const { notes, cc, bends } = commitAndCapture(b)

      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 64, tick: 480 })

      expect(cc).toHaveLength(1)
      expect(cc[0]).toMatchObject({ controller: 10, value: 64, tick: 480 })

      expect(bends).toHaveLength(1)
      expect(bends[0]).toMatchObject({ value: 8192, tick: 960 })
    })
  })
})
