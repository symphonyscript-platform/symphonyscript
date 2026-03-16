/**
 * DecrescendoBuilder & decrescendo() cue test
 *
 * Tests DecrescendoBuilder (returned by `decrescendo()`), a ScopedStepBuilder that wraps
 * the bridge in VelocityRampBridge to decrease velocity from `from` to `to`
 * over `duration` ticks.
 *
 * Covers:
 *   - decrescendo().steps(note(...)) — velocity decreases
 *   - Default from (1000) to (400) over duration (480)
 *   - .duration(), .from(), .to(), .curve() chaining
 *   - Precise bypass
 *   - Default (cascading) usage
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { decrescendo } from '../../cues/crescendo'
import { createBridge, commitAndCapture } from '../test-utils'

describe('DecrescendoBuilder', () => {

  // ========================================================================
  // decrescendo() cue
  // ========================================================================

  describe('decrescendo() cue', () => {
    it('should return DecrescendoBuilder instance', () => {
      expect(decrescendo()).toBeDefined()
      expect(decrescendo().steps).toBeDefined()
      expect(typeof decrescendo().steps).toBe('function')
    })

    it('should accept optional duration param', () => {
      expect(decrescendo(960)).toBeDefined()
    })
  })

  // ========================================================================
  // decrescendo().steps(note(...)) — velocity decreases
  // ========================================================================

  describe('velocity decreases', () => {
    it('should start at from velocity and decrease toward to', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = decrescendo(960)
        .steps(note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(1000)  // start of ramp (default from)
      expect(notes[0].pitch).toBe(60)
    })

    it('should ramp velocity from 1000 to 400 over three notes (default from/to)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = decrescendo(960)
        .steps(note('C4'), note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(1000)  // tick 0: progress 0
      expect(notes[1].velocity).toBe(700)    // tick 480: progress 0.5
      expect(notes[2].velocity).toBe(400)    // tick 960: progress 1
    })

    it('should use custom from/to when chained', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = decrescendo(960)
        .from(127)
        .to(64)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(127)
      expect(notes[1].velocity).toBe(96)   // 127 + (64-127)*0.5 = 127 - 31.5 ≈ 96
    })

    it('should advance tick correctly after scope exits', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = decrescendo(960)
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
      const result = decrescendo()
        .duration(480)
        .from(200)
        .to(100)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(200)
      expect(notes[1].velocity).toBe(100)   // tick 480 = end of 480-tick ramp
    })

    it('.curve() should affect easing', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = decrescendo(960)
        .from(200)
        .to(100)
        .curve('exponential')
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(200)
      // progress 0.5 → eased 0.25 → 200 + (100-200)*0.25 = 175
      expect(notes[1].velocity).toBe(175)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise inside scope', () => {
    it('note().precise() still receives ramp velocity (VelocityRampBridge has no precise bypass)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      const result = decrescendo(960)
        .steps(note('C4').precise(), note('C4').precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // VelocityRampBridge does not check precise; ramp still applies.
      // Note 0 at tick 0: progress 0 → 1000 (from). Note 1 at tick 480: progress 0.5 → 700.
      expect(notes[0].velocity).toBe(1000)
      expect(notes[1].velocity).toBe(700)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('decrescendo().default().apply() should return bridge that cascades decrescendo downstream', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = decrescendo(960).default().apply(bridge)
      b = note('C4').apply(b)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(1000)
      expect(notes[1].velocity).toBe(700)   // progress 0.5 → 1000 + (400-1000)*0.5
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = decrescendo(480)
      const withDuration = base.duration(960)
      const withFrom = base.from(127)

      expect(base).not.toBe(withDuration)
      expect(base).not.toBe(withFrom)
    })
  })
})
