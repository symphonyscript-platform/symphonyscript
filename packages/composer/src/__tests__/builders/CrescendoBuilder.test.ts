/**
 * CrescendoBuilder & crescendo() cue test
 *
 * Tests CrescendoBuilder (returned by `crescendo()`), a ScopedStepBuilder that wraps
 * the bridge in VelocityRampBridge to increase velocity from `from` to `to`
 * over `duration` ticks.
 *
 * Covers:
 *   - crescendo().steps(note(...)) — velocity increases
 *   - Default from (400) to (1000) over duration (480)
 *   - .duration(), .from(), .to(), .curve() chaining
 *   - Precise bypass
 *   - Default (cascading) usage
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { crescendo } from '../../cues/crescendo'
import { createBridge, commitAndCapture } from '../test-utils'

describe('CrescendoBuilder', () => {

  // ========================================================================
  // crescendo() cue
  // ========================================================================

  describe('crescendo() cue', () => {
    it('should return CrescendoBuilder instance', () => {
      expect(crescendo()).toBeDefined()
      expect(crescendo().steps).toBeDefined()
      expect(typeof crescendo().steps).toBe('function')
    })

    it('should accept optional duration param', () => {
      expect(crescendo(960)).toBeDefined()
    })
  })

  // ========================================================================
  // crescendo().steps(note(...)) — velocity increases
  // ========================================================================

  describe('velocity increases', () => {
    it('should start at from velocity and increase toward to', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo(960)
        .steps(note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(400)   // start of ramp (default from)
      expect(notes[0].pitch).toBe(60)
    })

    it('should ramp velocity from 400 to 1000 over three notes (default duration 480)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo(960)
        .steps(note('C4'), note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(400)   // tick 0: progress 0
      expect(notes[1].velocity).toBe(700)   // tick 480: progress 0.5
      expect(notes[2].velocity).toBe(1000)  // tick 960: progress 1 (clamped)
    })

    it('should use custom from/to when chained', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo(960)
        .from(64)
        .to(127)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(64)
      expect(notes[1].velocity).toBe(96)   // 64 + (127-64)*0.5
    })

    it('should advance tick correctly after scope exits', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo(960)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      expect(result.tick).toBe(960)
    })
  })

  // ========================================================================
  // Method chaining
  // ========================================================================

  describe('method chaining', () => {
    it('.duration() should set ramp duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo()
        .duration(480)
        .from(100)
        .to(200)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(100)
      expect(notes[1].velocity).toBe(200)   // tick 480 = end of 480-tick ramp
    })

    it('.curve() should affect easing (exponential yields slower start)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = crescendo(960)
        .from(100)
        .to(200)
        .curve('exponential')
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(100)
      // progress 0.5 → eased 0.25 → 100 + 100*0.25 = 125
      expect(notes[1].velocity).toBe(125)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise inside scope', () => {
    it('note().precise() still receives ramp velocity (VelocityRampBridge has no precise bypass)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      const result = crescendo(960)
        .steps(note('C4').precise(), note('C4').precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // VelocityRampBridge does not check precise; ramp still applies.
      // Note 0 at tick 0: progress 0 → 400. Note 1 at tick 480: progress 0.5 → 800.
      expect(notes[0].velocity).toBe(400)
      expect(notes[1].velocity).toBe(700)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('crescendo().default().apply() should return bridge that cascades crescendo downstream', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = crescendo(960).default().apply(bridge)
      b = note('C4').apply(b)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(400)
      expect(notes[1].velocity).toBe(700)   // progress 0.5 → 400 + (1000-400)*0.5
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = crescendo(480)
      const withDuration = base.duration(960)
      const withFrom = base.from(64)

      expect(base).not.toBe(withDuration)
      expect(base).not.toBe(withFrom)
    })
  })
})
