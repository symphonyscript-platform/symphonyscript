/**
 * VelocityRampBridge Test — Bridge Decorator
 *
 * Tests VelocityRampBridge, a CompositionBridgeDecorator that ramps velocity
 * based on tick position within a window. Easing: linear = progress,
 * exponential = progress², smooth = 3t² - 2t³.
 *
 * Covers:
 *   - Linear ramp at start/mid/end
 *   - Exponential curve
 *   - Smooth curve
 *   - range <= 0 bypasses ramping
 */

import { describe, it, expect } from 'vitest'
import { VelocityRampBridge } from '../../composition/VelocityRampBridge'
import { createBridge, commitAndCapture } from '../test-utils'

describe('VelocityRampBridge', () => {
  function createVelocityRampBridge(params: {
    startTick: number
    endTick: number
    fromVelocity: number
    toVelocity: number
    curve: 'linear' | 'exponential' | 'smooth'
  }) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new VelocityRampBridge(bridge, params)
  }

  // ========================================================================
  // Linear ramp at start/mid/end
  // ========================================================================

  describe('linear ramp', () => {
    it('should apply fromVelocity at ramp start (progress 0)', () => {
      const vr = createVelocityRampBridge({
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'linear',
      })

      // First note at tick 0: progress 0 → velocity 64
      const r1 = vr.withNote(6000, 480)
      const { notes: n1 } = commitAndCapture(r1)
      expect(n1[0].velocity).toBe(64)
    })

    it('should interpolate linearly at ramp mid (progress 0.5)', () => {
      const vr = createVelocityRampBridge({
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'linear',
      })

      // Note 1 at tick 0, Note 2 at tick 480 (mid)
      let b = vr.withNote(6000, 480)
      b = b.withNote(6000, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      // Mid: 64 + (127-64)*0.5 = 64 + 31.5 = 95.5 → 96
      expect(notes[1].velocity).toBe(96)
    })

    it('should apply toVelocity at ramp end (progress 1)', () => {
      const vr = createVelocityRampBridge({
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'linear',
      })

      // 3 notes: ticks 0, 480, 960
      let b = vr.withNote(6000, 480)
      b = b.withNote(6000, 480)
      b = b.withNote(6000, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[2].velocity).toBe(127)
    })
  })

  // ========================================================================
  // Exponential curve
  // ========================================================================

  describe('exponential curve', () => {
    it('should apply exponential easing (progress²)', () => {
      const vr = createVelocityRampBridge({
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'exponential',
      })

      // Mid: progress 0.5 → eased 0.25 → velocity 64 + 63*0.25 = 79.75 → 80
      let b = vr.withNote(6000, 480)
      b = b.withNote(6000, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[1].velocity).toBe(80)
    })
  })

  // ========================================================================
  // Smooth curve
  // ========================================================================

  describe('smooth curve', () => {
    it('should apply smoothstep easing (3t² - 2t³)', () => {
      const vr = createVelocityRampBridge({
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'smooth',
      })

      // At progress 0.25: smoothstep = 3*0.0625 - 2*0.015625 = 0.15625
      // velocity = 64 + 63*0.15625 ≈ 73.84 → 74
      // Tick 240 = 0.25 of 960, so we need 1 note at 0 + 1 note advancing 240
      const base = createBridge({ defaultDuration: 240, velocity: 100 })
      const vr240 = new VelocityRampBridge(base, {
        startTick: 0,
        endTick: 960,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'smooth',
      })

      let b = vr240.withNote(6000, 240)
      b = b.withNote(6000, 240)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[1].velocity).toBe(74)
    })
  })

  // ========================================================================
  // Range <= 0 bypass
  // ========================================================================

  describe('range <= 0 bypass', () => {
    it('should bypass ramping when range is 0 (startTick === endTick)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const vr = new VelocityRampBridge(bridge, {
        startTick: 0,
        endTick: 0,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'linear',
      })

      const result = vr.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      // Bypass passes through default velocity (100), not ramped
      expect(notes[0].velocity).toBe(100)
    })

    it('should bypass ramping when range is negative (endTick < startTick)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const vr = new VelocityRampBridge(bridge, {
        startTick: 100,
        endTick: 50,
        fromVelocity: 64,
        toVelocity: 127,
        curve: 'linear',
      })

      const result = vr.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(100)
    })
  })
})
