/**
 * DynamicsBridge Test — Bridge Decorator
 *
 * Tests DynamicsBridge, a CompositionBridgeDecorator that ramps velocity
 * from startVelocity to endVelocity over startTick..endTick.
 * Formula: t = (tick - startTick)/(endTick - startTick), rampedVelocity = start + (end-start)*t
 *
 * Covers:
 *   - Velocity at start, mid, end of range
 *   - Precise bypass skips ramp processing
 */

import { describe, it, expect } from 'vitest'
import { DynamicsBridge } from '../../composition/DynamicsBridge'
import { createBridge, commitAndCapture } from '../test-utils'

describe('DynamicsBridge', () => {

  function createDynamicsBridge(
    params: { startVelocity: number; endVelocity: number; startTick: number; endTick: number },
    bridgeOverrides: { defaultDuration?: number; velocity?: number; precise?: boolean } = {},
  ) {
    const bridge = createBridge({
      defaultDuration: bridgeOverrides.defaultDuration ?? 480,
      velocity: bridgeOverrides.velocity ?? 100,
      precise: bridgeOverrides.precise ?? false,
    })
    return new DynamicsBridge(bridge, params)
  }

  // ========================================================================
  // Velocity ramp: start, mid, end
  // ========================================================================

  describe('velocity ramp', () => {
    it('should apply startVelocity at start of range', () => {
      const db = createDynamicsBridge({
        startVelocity: 64,
        endVelocity: 127,
        startTick: 0,
        endTick: 960,
      })

      const result = db.withNote(60, 480)
      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(64)
    })

    it('should interpolate velocity at mid range', () => {
      const db = createDynamicsBridge({
        startVelocity: 64,
        endVelocity: 127,
        startTick: 0,
        endTick: 960,
      })

      let b = db.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      // tick 480: t = 480/960 = 0.5 → 64 + (127-64)*0.5 = 95.5 → 96
      expect(notes[1].velocity).toBe(96)
    })

    it('should apply endVelocity at end of range', () => {
      const db = createDynamicsBridge({
        startVelocity: 64,
        endVelocity: 127,
        startTick: 0,
        endTick: 960,
      })

      let b = db.withNote(60, 480)
      b = b.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes[2].velocity).toBe(127)
    })

    it('should ramp correctly with arbitrary startTick', () => {
      const db = createDynamicsBridge(
        {
          startVelocity: 50,
          endVelocity: 100,
          startTick: 480,
          endTick: 1440,
        },
        { defaultDuration: 480 },
      )

      let b = db.withNote(60, 480)   // tick 0 → t clamped to 0 → 50
      b = b.withNote(60, 480)       // tick 480 → t = 0 → 50
      b = b.withNote(60, 480)       // tick 960 → t = 0.5 → 75
      b = b.withNote(60, 480)       // tick 1440 → t = 1 → 100

      const { notes } = commitAndCapture(b)
      expect(notes[0].velocity).toBe(50)   // tick 0 < startTick → clamped
      expect(notes[1].velocity).toBe(50)   // tick 480, t = 0
      expect(notes[2].velocity).toBe(75)   // tick 960, t = 0.5
      expect(notes[3].velocity).toBe(100) // tick 1440, t = 1
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip ramp when precise flag is set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const db = new DynamicsBridge(bridge, {
        startVelocity: 20,
        endVelocity: 127,
        startTick: 0,
        endTick: 960,
      })

      let b = db.withNote(60, 480)
      b = b.withNote(60, 480)
      b = b.withNote(60, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      // All notes use bridge default velocity (100), no ramp applied
      expect(notes[0].velocity).toBe(100)
      expect(notes[1].velocity).toBe(100)
      expect(notes[2].velocity).toBe(100)
    })
  })
})
