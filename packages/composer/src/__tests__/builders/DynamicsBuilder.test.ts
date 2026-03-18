/**
 * DynamicsBuilder & dynamics() cue test
 *
 * Tests DynamicsBuilder (returned by `dynamics()`), a ScopedStepBuilder that wraps
 * the bridge in DynamicsBridge to apply a velocity ramp from startVelocity to
 * endVelocity over startTick..endTick.
 *
 * Covers:
 *   - dynamics(startVel, endVel, startTick, endTick).steps(note(...)) — velocity ramp
 *   - Linear interpolation at start, mid, end
 *   - .startVelocity(), .endVelocity(), .start(), .end() chaining
 *   - Precise bypass
 *   - Default (cascading) usage
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { dynamics } from '../../cues/dynamics'
import { createBridge, commitAndCapture } from '../test-utils'

describe('DynamicsBuilder', () => {

  // ========================================================================
  // dynamics() cue
  // ========================================================================

  describe('dynamics() cue', () => {
    it('should return DynamicsBuilder instance', () => {
      expect(dynamics()).toBeDefined()
      expect(dynamics().steps).toBeDefined()
      expect(typeof dynamics().steps).toBe('function')
    })

    it('should accept optional params: startVelocity, endVelocity, startTick, endTick', () => {
      const b = dynamics(400, 1000, 0, 480)
      expect(b).toBeDefined()
    })
  })

  // ========================================================================
  // dynamics(...).steps(note(...)) — velocity ramp
  // ========================================================================

  describe('velocity ramp', () => {
    it('should apply startVelocity at start of range', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(400, 1000, 0, 960)
        .steps(note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(400)
      expect(notes[0].pitch).toBe(6000)
    })

    it('should interpolate velocity linearly at mid range', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(400, 1000, 0, 960)
        .steps(note(6000), note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(400)   // tick 0: t=0
      expect(notes[1].velocity).toBe(700)   // tick 480: t=0.5 → 400 + 600*0.5 = 700
    })

    it('should apply endVelocity at end of range', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(400, 1000, 0, 960)
        .steps(note(6000), note(6000), note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(400)
      expect(notes[1].velocity).toBe(700)
      expect(notes[2].velocity).toBe(1000)
    })

    it('should ramp with custom startTick and endTick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(50, 150, 480, 1440)
        .steps(note(6000), note(6000), note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(50)    // tick 0 < startTick → clamped to 50
      expect(notes[1].velocity).toBe(50)    // tick 480 = startTick → t=0
      expect(notes[2].velocity).toBe(100)   // tick 960: t=(960-480)/(1440-480)=0.5 → 50+50=100
    })
  })

  // ========================================================================
  // Method chaining
  // ========================================================================

  describe('method chaining', () => {
    it('.startVelocity() and .endVelocity() should override params', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(100, 200)
        .startVelocity(64)
        .endVelocity(127)
        .start(0)
        .end(960)
        .steps(note(6000), note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(64)
      expect(notes[1].velocity).toBe(96)   // 64 + (127-64)*0.5
    })

    it('.start() and .end() should set ramp range', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = dynamics(100, 200)
        .start(0)
        .end(480)
        .steps(note(6000), note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(100)   // tick 0
      expect(notes[1].velocity).toBe(200)   // tick 480 = end
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('note().precise() should skip dynamics ramp even inside dynamics scope', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      const result = dynamics(64, 127, 0, 960)
        .steps(note(6000).precise(), note(6000).precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(800)
      expect(notes[1].velocity).toBe(800)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('dynamics().default().apply() should return bridge that cascades ramp downstream', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = dynamics(400, 1000, 0, 960).default().apply(bridge)
      b = note(6000).apply(b)
      b = note(6000).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(400)
      expect(notes[1].velocity).toBe(700)
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = dynamics(400, 1000)
      const withStart = base.startVelocity(300)
      const withEnd = base.endVelocity(900)

      expect(base).not.toBe(withStart)
      expect(base).not.toBe(withEnd)
    })
  })
})
