/**
 * ChanceBuilder Test — Builder + chance() cue
 *
 * Tests ChanceBuilder (returned by `chance()`), wrapping inner steps in ChanceBridge.
 * Covers:
 *   - chance(1) always emits notes (probability 1)
 *   - chance(0) never emits notes (probability 0)
 *   - Seed for deterministic behavior
 *   - chance(probability?, seed?) API
 *   - .probability() and .seed() builder methods
 */

import { describe, it, expect } from 'vitest'
import { chance } from '../../cues/chance'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('ChanceBuilder', () => {

  // ========================================================================
  // probability 1 — always emits
  // ========================================================================

  describe('probability 1', () => {
    it('should always emit when probability is 1', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(1).steps(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].tick).toBe(0)
      expect(result.tick).toBe(480)
    })

    it('should emit all notes in sequence when probability is 1', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(1)
        .steps(note(6000), note(6400), note(6700))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
      expect(result.tick).toBe(1440)
    })

    it('should default to probability 1 when omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance().steps(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })
  })

  // ========================================================================
  // probability 0 — never emits
  // ========================================================================

  describe('probability 0', () => {
    it('should never emit when probability is 0', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(0).steps(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should advance tick when note is skipped (probability 0)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(0).steps(note(6000)).apply(bridge)

      expect(result.tick).toBe(480)
    })

    it('should accumulate tick advances for multiple skipped notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(0)
        .steps(note(6000), note(6400), note(6700))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(1440)
    })

    it('should use .probability(0) builder method', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(1).probability(0).steps(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  // ========================================================================
  // Seed for determinism
  // ========================================================================

  describe('determinism with seed', () => {
    it('should produce identical results with same seed', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const seed = 42

      const result1 = chance(0.5, seed)
        .steps(note(6000), note(6400), note(6700), note(6000), note(6400), note(6700))
        .apply(bridge)

      const bridge2 = createBridge({ defaultDuration: 480 })
      const result2 = chance(0.5, seed)
        .steps(note(6000), note(6400), note(6700), note(6000), note(6400), note(6700))
        .apply(bridge2)

      const { notes: n1 } = commitAndCapture(result1)
      const { notes: n2 } = commitAndCapture(result2)

      expect(n1.length).toBe(n2.length)
      n1.forEach((n, idx) => {
        expect(n2[idx].pitch).toBe(n.pitch)
        expect(n2[idx].tick).toBe(n.tick)
      })
    })

    it('should produce different results with different seeds', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result1 = chance(0.5, 111)
        .steps(
          note(6000), note(6400), note(6700), note(6000), note(6400), note(6700),
          note(6000), note(6400), note(6700), note(6000), note(6400), note(6700),
        )
        .apply(bridge)

      const bridge2 = createBridge({ defaultDuration: 480 })
      const result2 = chance(0.5, 222)
        .steps(
          note(6000), note(6400), note(6700), note(6000), note(6400), note(6700),
          note(6000), note(6400), note(6700), note(6000), note(6400), note(6700),
        )
        .apply(bridge2)

      const { notes: n1 } = commitAndCapture(result1)
      const { notes: n2 } = commitAndCapture(result2)

      const sameOutcome = n1.length === n2.length && n1.every((n, i) => n.tick === n2[i].tick)
      expect(sameOutcome).toBe(false)
    })

    it('should use .seed() builder method for determinism', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result1 = chance(0.5).seed(999)
        .steps(note(6000), note(6400), note(6700), note(6000), note(6400), note(6700))
        .apply(bridge)

      const bridge2 = createBridge({ defaultDuration: 480 })
      const result2 = chance(0.5).seed(999)
        .steps(note(6000), note(6400), note(6700), note(6000), note(6400), note(6700))
        .apply(bridge2)

      const { notes: n1 } = commitAndCapture(result1)
      const { notes: n2 } = commitAndCapture(result2)

      expect(n1.length).toBe(n2.length)
      n1.forEach((n, idx) => {
        expect(n2[idx].pitch).toBe(n.pitch)
        expect(n2[idx].tick).toBe(n.tick)
      })
    })
  })

  // ========================================================================
  // chance() API
  // ========================================================================

  describe('chance(probability?, seed?)', () => {
    it('should return ChanceBuilder instance', () => {
      const b = chance()
      expect(b).toBeDefined()
      expect(b.steps).toBeDefined()
      expect(b.probability).toBeDefined()
      expect(b.seed).toBeDefined()
      expect(b.apply).toBeDefined()
    })

    it('chance(1) with steps should apply ChanceBridge and always pass', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(1).steps(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })

    it('chance(probability, seed) should accept both args', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chance(0.3, 12345).steps(note(6000)).apply(bridge)

      // With 0.3, may or may not emit; just verify no error
      const { notes } = commitAndCapture(result)
      expect(notes.length).toBeLessThanOrEqual(1)
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const base = chance(0.5).steps(note(6000))
      const withProb = base.probability(0)
      const withSeed = base.seed(42)

      const bridge = createBridge({ defaultDuration: 480 })

      const baseResult = commitAndCapture(base.apply(bridge))
      const probResult = commitAndCapture(withProb.apply(createBridge({ defaultDuration: 480 })))
      const seedResult = commitAndCapture(withSeed.apply(createBridge({ defaultDuration: 480 })))

      // base and withSeed both have prob 0.5; withProb has prob 0 (never emits)
      expect(probResult.notes).toHaveLength(0)
      // base and withSeed may emit depending on rng
      expect(baseResult.notes.length).toBeLessThanOrEqual(1)
      expect(seedResult.notes.length).toBeLessThanOrEqual(1)
    })
  })
})
