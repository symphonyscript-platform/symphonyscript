/**
 * GrooveBuilder & groove() notation test
 *
 * Tests GrooveBuilder (returned by `groove()`), a ScopedStepBuilder that wraps
 * the bridge in GrooveBridge to apply per-step velocity scaling, timing offset,
 * and probability.
 *
 * Covers:
 *   - groove().step(...).steps(note(...)) applies GrooveBridge
 *   - Velocity scaling: step.velocity multiplies bridge velocity
 *   - Timing offset: step.timing * grid shifts note placement
 *   - Precise bypass
 *   - .grid() and .seed() chaining
 *   - Default (cascading) usage
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { groove } from '../../cues/groove'
import { createBridge, commitAndCapture } from '../test-utils'

describe('GrooveBuilder', () => {

  // ========================================================================
  // groove() notation
  // ========================================================================

  describe('groove() notation', () => {
    it('should return GrooveBuilder instance', () => {
      expect(groove()).toBeDefined()
      expect(groove().steps).toBeDefined()
      expect(typeof groove().steps).toBe('function')
    })

    it('should accept optional grid param', () => {
      expect(groove(480)).toBeDefined()
      expect(groove(240)).toBeDefined()
    })
  })

  // ========================================================================
  // groove().step(...).steps(note(...)) — velocity scaling
  // ========================================================================

  describe('velocity scaling', () => {
    it('should scale velocity by step.velocity — first step 0.5, second 1.0', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      const result = groove(480)
        .step(0.5)
        .step(1.0)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].velocity).toBe(400)   // 800 * 0.5
      expect(notes[1].velocity).toBe(800)  // 800 * 1.0
    })

    it('should scale velocity with multiple steps cycling by grid', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 1000 })
      const result = groove(480)
        .step(0.5)
        .step(0.8)
        .step(1.2)
        .steps(note('C4'), note('C4'), note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].velocity).toBe(500)   // tick 0: step 0 → 1000 * 0.5
      expect(notes[1].velocity).toBe(800)    // tick 480: step 1 → 1000 * 0.8
      expect(notes[2].velocity).toBe(1200)   // tick 960: step 2 → 1000 * 1.2 (clamped by MIDI? no, we just round)
      expect(notes[3].velocity).toBe(500)    // tick 1440: step 0 again
    })
  })

  // ========================================================================
  // Timing offset
  // ========================================================================

  describe('timing offset', () => {
    it('should apply timing offset — step with timing 0.5 shifts note by half grid', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = groove(480)
        .step(1.0, 0.5)
        .steps(note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      // tickOffset = round(0.5 * 480) = 240, note placed at 0 + 240
      expect(notes[0].tick).toBe(240)
      expect(notes[0].pitch).toBe(60)
    })

    it('should apply different timing offsets per step', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = groove(480)
        .step(1.0, 0)
        .step(1.0, 0.25)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)     // timing 0 → offset 0
      expect(notes[1].tick).toBe(600)   // tick 480 + offset 120 (0.25 * 480) = 600
    })

    it('should advance tick correctly after scope (including timing offsets)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = groove(480)
        .step(1.0, 0.25)
        .steps(note('C4'), note('C4'))
        .apply(bridge)

      // Note 1: tick 0 + 120 = 120, advances to 120 + 480 = 600
      // Note 2: tick 600 + 120 = 720 (step 1 at tick 600: floor(600/480)%2 = 1, step has timing 0.25)
      // Actually: at tick 600, stepIndex = floor(600/480) = 1, step timing 0.25 → offset 120
      // So note at 600+120 = 720, duration 480 → exit tick 720+480 = 1200
      expect(result.tick).toBe(1200)
    })
  })

  // ========================================================================
  // .grid() chain
  // ========================================================================

  describe('grid param', () => {
    it('.grid() should override initial grid for timing calculation', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = groove(480)
        .grid(240)
        .step(1.0, 0.5)
        .steps(note('C4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      // tickOffset = round(0.5 * 240) = 120
      expect(notes[0].tick).toBe(120)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('note().precise() should skip groove even inside groove scope', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      const result = groove(480)
        .step(0.5)
        .steps(note('C4').precise(), note('C4').precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      // Precise bypasses groove: no velocity scaling, no timing offset
      expect(notes[0].velocity).toBe(800)
      expect(notes[1].velocity).toBe(800)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('groove().default().apply() should return bridge that cascades groove downstream', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })
      let b = groove(480).step(0.5).default().apply(bridge)
      b = note('C4').apply(b)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      // Both notes get velocity 400 (0.5 scale) — single step cycles
      expect(notes[0].velocity).toBe(400)
      expect(notes[1].velocity).toBe(400)
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = groove(480).step(1.0)
      const withGrid = base.grid(240)
      const withStep = base.step(0.5)

      expect(base).not.toBe(withGrid)
      expect(base).not.toBe(withStep)
    })
  })
})
