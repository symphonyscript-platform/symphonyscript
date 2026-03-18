/**
 * Tests HumanizationBridge: velocity jitter and timing offset.
 *
 * HumanizationBridge adds randomized velocity and timing variations via:
 *   jitter(amount) = (rng.next() * 2 - 1) * amount
 *
 * Covers:
 *   - Velocity jitter: output velocity differs from input (within ±velocityJitter)
 *   - Timing offset: output tick differs from input (within ±timingAmount)
 *   - Precise bypass: no jitter when precise is set
 *   - Deterministic with seed: same seed produces identical output
 */

import { describe, it, expect } from 'vitest'
import { HumanizationBridge } from '../../composition/HumanizationBridge'
import { createBridge, commitAndCapture } from '../test-utils'
import { SeededRandom } from '@symphonyscript/core'

describe('HumanizationBridge', () => {

  function createHumanizationBridge(
    velocityJitter: number,
    timingAmount: number,
    seed: number = 42,
  ) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new HumanizationBridge(bridge, {
      velocityJitter,
      timingAmount,
      rng: new SeededRandom(seed),
    })
  }

  // ========================================================================
  // Velocity jitter
  // ========================================================================

  describe('velocity jitter', () => {
    it('should apply velocity jitter so output differs from input', () => {
      const hb = createHumanizationBridge(20, 0, 123)
      const result = hb.withNote(6000, 480, 80)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).not.toBe(80)
      expect(notes[0].velocity).toBeGreaterThanOrEqual(60)
      expect(notes[0].velocity).toBeLessThanOrEqual(100)
    })

    it('should use bridge velocity when note velocity not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 90 })
      const hb = new HumanizationBridge(bridge, {
        velocityJitter: 15,
        timingAmount: 0,
        rng: new SeededRandom(7),
      })
      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBeGreaterThanOrEqual(75)
      expect(notes[0].velocity).toBeLessThanOrEqual(105)
    })

    it('should not modify velocity when velocityJitter is 0', () => {
      const hb = createHumanizationBridge(0, 10, 42)
      const result = hb.withNote(6000, 480, 100)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(100)
    })
  })

  // ========================================================================
  // Timing offset
  // ========================================================================

  describe('timing offset', () => {
    it('should apply tick offset so output tick differs from input', () => {
      const hb = createHumanizationBridge(0, 24, 456)
      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].tick).not.toBe(0)
      expect(notes[0].tick).toBeGreaterThanOrEqual(-24)
      expect(notes[0].tick).toBeLessThanOrEqual(24)
    })

    it('should not modify tick when timingAmount is 0', () => {
      const hb = createHumanizationBridge(10, 0, 42)
      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].tick).toBe(0)
    })

    it('should offset tick for subsequent notes at non-zero tick', () => {
      const hb = createHumanizationBridge(0, 12, 99)
      let b = hb.withNote(6000, 480)
      b = b.withNote(6200, 480)
      const { notes } = commitAndCapture(b)

      expect(notes).toHaveLength(2)
      const firstTick = notes[0].tick
      const secondTick = notes[1].tick
      expect(secondTick).not.toBe(480)
      expect(secondTick).toBeGreaterThanOrEqual(480 - 12)
      expect(secondTick).toBeLessThanOrEqual(480 + 12)
    })
  })

  // ========================================================================
  // Combined jitter
  // ========================================================================

  describe('combined velocity and timing jitter', () => {
    it('should apply both velocity and timing jitter', () => {
      const hb = createHumanizationBridge(15, 20, 777)
      const result = hb.withNote(6000, 480, 100)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBeGreaterThanOrEqual(85)
      expect(notes[0].velocity).toBeLessThanOrEqual(115)
      expect(notes[0].tick).toBeGreaterThanOrEqual(-20)
      expect(notes[0].tick).toBeLessThanOrEqual(20)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip humanization when precise flag is set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const hb = new HumanizationBridge(bridge, {
        velocityJitter: 50,
        timingAmount: 100,
        rng: new SeededRandom(42),
      })

      const result = hb.withNote(6000, 480, 80)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(80)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Determinism
  // ========================================================================

  describe('determinism', () => {
    it('should produce identical output with same seed', () => {
      const seed = 12345
      const hb1 = createHumanizationBridge(20, 24, seed)
      const hb2 = createHumanizationBridge(20, 24, seed)

      let b1 = hb1.withNote(6000, 480, 90)
      b1 = b1.withNote(6200, 480, 70)
      let b2 = hb2.withNote(6000, 480, 90)
      b2 = b2.withNote(6200, 480, 70)

      const { notes: n1 } = commitAndCapture(b1)
      const { notes: n2 } = commitAndCapture(b2)

      expect(n1).toHaveLength(2)
      expect(n2).toHaveLength(2)
      expect(n1[0].velocity).toBe(n2[0].velocity)
      expect(n1[0].tick).toBe(n2[0].tick)
      expect(n1[1].velocity).toBe(n2[1].velocity)
      expect(n1[1].tick).toBe(n2[1].tick)
    })

    it('should produce different output with different seeds', () => {
      const hb1 = createHumanizationBridge(30, 30, 1)
      const hb2 = createHumanizationBridge(30, 30, 2)

      const r1 = hb1.withNote(6000, 480, 100)
      const r2 = hb2.withNote(6000, 480, 100)

      const { notes: n1 } = commitAndCapture(r1)
      const { notes: n2 } = commitAndCapture(r2)

      const differs = n1[0].velocity !== n2[0].velocity || n1[0].tick !== n2[0].tick
      expect(differs).toBe(true)
    })
  })
})
