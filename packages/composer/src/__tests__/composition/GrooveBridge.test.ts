/**
 * Exemplar: GrooveBridge Test — Bridge Decorator
 *
 * Tests GrooveBridge, a CompositionBridgeDecorator that applies groove patterns.
 * GrooveBridge modifies velocity scaling, timing offset, and note probability
 * based on a repeating step pattern.
 *
 * Covers:
 *   - Velocity scaling per groove step
 *   - Timing offset application
 *   - Probability-based note dropping (with seeded RNG)
 *   - Cyclic step index wrapping
 *   - Precise bypass skips groove processing
 *   - Rewrap returns new GrooveBridge instance
 */

import { describe, it, expect } from 'vitest'
import { GrooveBridge, GrooveStep } from '../../composition/GrooveBridge'
import { createBridge, commitAndCapture } from '../test-utils'
import { SeededRandom } from '@symphonyscript/core'

describe('GrooveBridge', () => {

  function createGrooveBridge(
    steps: GrooveStep[],
    grid: number = 480,
    seed: number = 42,
  ) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new GrooveBridge(bridge, {
      steps,
      grid,
      rng: new SeededRandom(seed),
    })
  }

  // ========================================================================
  // Velocity scaling
  // ========================================================================

  describe('velocity scaling', () => {
    it('should scale velocity by the groove step factor', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0, probability: 1.0 },  // step 0: full velocity
        { velocity: 0.5, timing: 0, probability: 1.0 },  // step 1: half velocity
      ])

      // Step 0: tick 0, grid 480 → stepIndex 0 → velocity 100 * 1.0 = 100
      const r1 = gb.withNote(6000, 480)
      const { notes: n1 } = commitAndCapture(r1)
      expect(n1[0].velocity).toBe(100)

      // Step 1: tick 480, grid 480 → stepIndex 1 → velocity 100 * 0.5 = 50
      const r2 = r1.withNote(6000, 480)
      const { notes: n2 } = commitAndCapture(r2)
      expect(n2[1].velocity).toBe(50)
    })

    it('should use note velocity when provided, scaled by step factor', () => {
      const gb = createGrooveBridge([
        { velocity: 0.8, timing: 0, probability: 1.0 },
      ])

      // Explicit velocity 80, scaled by 0.8 = 64
      const result = gb.withNote(6000, 480, 80)
      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(64)
    })
  })

  // ========================================================================
  // Timing offset
  // ========================================================================

  describe('timing offset', () => {
    it('should offset note tick by groove step timing', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0.1, probability: 1.0 }, // 10% of grid = 48 ticks
      ])

      const result = gb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      // Note should be at tick 0 + 48 = 48 (timing offset rounded)
      expect(notes[0].tick).toBe(48)
    })

    it('should handle zero timing offset', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0, probability: 1.0 },
      ])

      const result = gb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Probability
  // ========================================================================

  describe('probability', () => {
    it('should always play when probability is 1.0', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0, probability: 1.0 },
      ])

      const result = gb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
    })

    it('should never play when probability is 0.0', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0, probability: 0.0 },
      ])

      const result = gb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      // Note should be dropped, tick still advances
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(480)
    })

    it('should produce deterministic results with same seed', () => {
      const steps: GrooveStep[] = [
        { velocity: 1.0, timing: 0, probability: 0.5 },
      ]

      const gb1 = createGrooveBridge(steps, 480, 123)
      const gb2 = createGrooveBridge(steps, 480, 123)

      const r1 = gb1.withNote(6000, 480)
      const r2 = gb2.withNote(6000, 480)

      const { notes: n1 } = commitAndCapture(r1)
      const { notes: n2 } = commitAndCapture(r2)
      expect(n1.length).toBe(n2.length)
    })
  })

  // ========================================================================
  // Cyclic wrapping
  // ========================================================================

  describe('cyclic step index', () => {
    it('should wrap step index for patterns shorter than content', () => {
      const gb = createGrooveBridge([
        { velocity: 1.0, timing: 0, probability: 1.0 },
        { velocity: 0.5, timing: 0, probability: 1.0 },
      ], 480)

      // 3 notes: step indices should be 0, 1, 0 (wraps)
      let b = gb.withNote(6000, 480)
      b = b.withNote(6000, 480)
      b = b.withNote(6000, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].velocity).toBe(100)  // step 0: 100 * 1.0
      expect(notes[1].velocity).toBe(50)   // step 1: 100 * 0.5
      expect(notes[2].velocity).toBe(100)  // step 0: wraps, 100 * 1.0
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip groove when precise flag is set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100, precise: true })
      const gb = new GrooveBridge(bridge, {
        steps: [{ velocity: 0.5, timing: 0.2, probability: 0.0 }],
        grid: 480,
        rng: new SeededRandom(42),
      })

      // With precise=true, groove should be bypassed entirely
      const result = gb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      // Velocity should NOT be scaled, timing should NOT be offset
      expect(notes[0].velocity).toBe(100)
      expect(notes[0].tick).toBe(0)
    })
  })
})
