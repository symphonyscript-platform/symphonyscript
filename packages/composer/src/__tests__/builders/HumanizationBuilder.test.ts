/**
 * Exemplar: Effect Builder Test — HumanizationBuilder
 *
 * Tests the HumanizationBuilder (returned by `humanize()`), a ScopedStepBuilder
 * subclass that wraps the bridge in a HumanizationBridge decorator.
 *
 * Covers:
 *   - Scoped usage: humanize().steps(note(6000), note(6200))
 *   - Default (cascading) usage: humanize() without .steps()
 *   - Velocity jitter within expected range
 *   - Timing jitter within expected range
 *   - Seed determinism (same seed → same output)
 *   - Precise flag bypasses humanization
 *   - Immutability of builders
 *   - Tick advance is preserved after scope exit
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { humanize } from '../../cues/humanize'
import { createBridge, commitAndCapture } from '../test-utils'
import { CompositionBridge } from '../../interfaces/composition-bridge'

describe('HumanizationBuilder', () => {

  // ========================================================================
  // Scoped usage
  // ========================================================================

  describe('scoped usage', () => {
    it('should apply humanization only to steps inside .steps()', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      // Humanize with seed for determinism — only inner notes are affected
      const result = humanize(100, 0)
        .seed(42)
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)

      // Velocities should be jittered — not exactly 800
      // With ±100 jitter, velocities should be in [700, 900]
      for (const n of notes) {
        expect(n.velocity).toBeGreaterThanOrEqual(700)
        expect(n.velocity).toBeLessThanOrEqual(900)
      }
    })

    it('should advance tick correctly after scope exits', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = humanize(0, 0)
        .seed(42)
        .steps(note(6000), note(6400))
        .apply(bridge)

      // Two notes × 480 duration = 960 (timing jitter is 0)
      expect(result.tick).toBe(960)
    })

    it('tick after scoped humanization should reflect inner content', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      // Apply humanization scoped, then another note after
      let b = humanize(50, 0).seed(1).steps(note(6000)).apply(bridge)
      b = note(6400).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      // E4 should start at tick 480 (after the scoped C4)
      expect(notes[1].tick).toBe(480)
    })
  })

  // ========================================================================
  // Default (cascading) usage
  // ========================================================================

  describe('default (cascading) usage', () => {
    it('should return a modified bridge when used without .steps()', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      // Apply humanization as cascading default
      const modified = humanize(100, 0).seed(42).default().apply(bridge)

      // The bridge should now be a HumanizationBridge decorator
      // Notes applied to it should be jittered
      const result = note(6000).apply(modified)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      // Velocity should be jittered (not exactly 800)
      expect(notes[0].velocity).not.toBe(800)
    })
  })

  // ========================================================================
  // Seed determinism
  // ========================================================================

  describe('seed determinism', () => {
    it('same seed should produce identical output', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      const run1 = commitAndCapture(
        humanize(100, 20).seed(42).steps(note(6000), note(6400)).apply(bridge),
      )

      const run2 = commitAndCapture(
        humanize(100, 20).seed(42).steps(note(6000), note(6400)).apply(bridge),
      )

      expect(run1.notes[0].velocity).toBe(run2.notes[0].velocity)
      expect(run1.notes[1].velocity).toBe(run2.notes[1].velocity)
      expect(run1.notes[0].tick).toBe(run2.notes[0].tick)
      expect(run1.notes[1].tick).toBe(run2.notes[1].tick)
    })

    it('different seeds should produce different output', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      const run1 = commitAndCapture(
        humanize(100, 20).seed(42).steps(note(6000), note(6400)).apply(bridge),
      )

      const run2 = commitAndCapture(
        humanize(100, 20).seed(999).steps(note(6000), note(6400)).apply(bridge),
      )

      // Very unlikely to be identical with different seeds
      const velocitiesMatch = run1.notes[0].velocity === run2.notes[0].velocity
        && run1.notes[1].velocity === run2.notes[1].velocity
      expect(velocitiesMatch).toBe(false)
    })
  })

  // ========================================================================
  // Precise flag bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('note().precise() should skip humanization even inside humanize scope', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      const result = humanize(100, 20)
        .seed(42)
        .steps(note(6000).precise())
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      // Precise note should have exact velocity (800) and exact tick (0)
      expect(notes[0].velocity).toBe(800)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Jitter bounds
  // ========================================================================

  describe('jitter bounds', () => {
    it('velocity jitter should stay within ±amount of base velocity', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      // Run many notes to test statistical bounds
      const builder = humanize(50, 0).seed(123)
      let b: CompositionBridge = bridge
      for (let i = 0; i < 20; i++) {
        b = builder.steps(note(6000)).apply(b)
      }

      const { notes } = commitAndCapture(b)
      for (const n of notes) {
        expect(n.velocity).toBeGreaterThanOrEqual(750) // 800 - 50
        expect(n.velocity).toBeLessThanOrEqual(850)    // 800 + 50
      }
    })

    it('zero jitter should produce unmodified velocity and timing', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 800 })

      const result = humanize(0, 0)
        .seed(42)
        .steps(note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(800)
      expect(notes[0].tick).toBe(0)
    })
  })

  // ========================================================================
  // Builder immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = humanize(50, 10)
      const withSeed = base.seed(42)
      const withVel = base.velocity(100)

      // They should be different builder instances
      expect(base).not.toBe(withSeed)
      expect(base).not.toBe(withVel)
    })
  })
})
