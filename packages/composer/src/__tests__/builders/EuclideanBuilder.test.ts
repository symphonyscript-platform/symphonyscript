/**
 * Tests for EuclideanBuilder and euclidean() notation.
 *
 * Covers:
 *   - euclidean(hits?, steps?) returns EuclideanBuilder
 *   - Tresillo (3,8) with 2 notes
 *   - Pattern cycles pitches across hits
 *   - Repeat applies pattern multiple times
 *   - stepDuration override
 *   - velocity override
 *   - Edge cases: no notes, empty notes, invalid pattern
 */

import { describe, it, expect } from 'vitest'
import { euclidean } from '../../notations/euclidean'
import { createBridge, commitAndCapture } from '../test-utils'

describe('euclidean notation', () => {

  it('should return EuclideanBuilder with fluent API', () => {
    const builder = euclidean(3, 8)
    expect(builder).toBeDefined()
    expect(typeof builder.notes).toBe('function')
    expect(typeof builder.apply).toBe('function')
  })

  it('should accept optional hits and steps', () => {
    const withArgs = euclidean(3, 8)
    const { notes } = commitAndCapture(withArgs.notes(['C4']).apply(createBridge({ defaultDuration: 480 })))
    expect(notes).toHaveLength(3)

    const noArgs = euclidean()
    const { notes: notes2 } = commitAndCapture(noArgs.notes(['C4']).apply(createBridge({ defaultDuration: 480 })))
    expect(notes2).toHaveLength(1) // defaults: hits=1, steps=4 → one hit
  })
})

describe('EuclideanBuilder', () => {

  // ========================================================================
  // Tresillo (3,8) with 2 notes
  // ========================================================================

  describe('tresillo (3,8) with 2 notes', () => {
    it('should apply euclidean(3,8).notes([C4,E4]).apply(bridge)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = euclidean(3, 8).notes(['C4', 'E4']).apply(bridge)

      const { notes } = commitAndCapture(result)

      // Tresillo: x--x--x- (3 hits at steps 0, 3, 6)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(480)
      expect(notes[1].pitch).toBe(64) // E4
      expect(notes[1].tick).toBe(1440) // 3 * 480
      expect(notes[2].pitch).toBe(60) // C4
      expect(notes[2].tick).toBe(2880) // 6 * 480
    })

    it('should advance bridge tick after full pattern', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 8).notes(['C4']).apply(bridge)

      // 8 steps × 480 = 3840
      expect(result.tick).toBe(3840)
    })
  })

  // ========================================================================
  // Pitch cycling
  // ========================================================================

  describe('pattern cycles pitches', () => {
    it('should cycle through pitches on successive hits', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      // Cinquillo (5,8): x-xx-xx- → 5 hits
      const result = euclidean(5, 8).notes(['C4', 'E4', 'G4']).apply(bridge)

      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(5)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[1].pitch).toBe(64) // E4
      expect(notes[2].pitch).toBe(67) // G4
      expect(notes[3].pitch).toBe(60) // C4 (cycle)
      expect(notes[4].pitch).toBe(64) // E4 (cycle)
    })

    it('should accept numeric MIDI pitches', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 8).notes([60, 64]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(60)
    })
  })

  // ========================================================================
  // Repeat
  // ========================================================================

  describe('repeat', () => {
    it('.repeat(2) should apply pattern twice', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = euclidean(3, 8).notes(['C4']).repeat(2).apply(bridge)

      const { notes } = commitAndCapture(result)

      // Tresillo: 3 hits per cycle × 2 = 6 notes
      expect(notes).toHaveLength(6)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(720)   // step 3
      expect(notes[2].tick).toBe(1440)  // step 6
      expect(notes[3].tick).toBe(1920)  // second cycle start
      expect(notes[4].tick).toBe(2640)
      expect(notes[5].tick).toBe(3360)

      expect(result.tick).toBe(3840) // 8 steps × 2 cycles × 240
    })
  })

  // ========================================================================
  // stepDuration and velocity overrides
  // ========================================================================

  describe('stepDuration override', () => {
    it('.stepDuration() should override bridge defaultDuration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 8).notes(['C4']).stepDuration(240).apply(bridge)

      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[1].tick).toBe(720) // 3 × 240
      expect(result.tick).toBe(1920)  // 8 × 240
    })
  })

  describe('velocity override', () => {
    it('.velocity() should override bridge velocity', () => {
      const bridge = createBridge({ velocity: 800 })
      const result = euclidean(3, 8).notes(['C4']).velocity(500).apply(bridge)

      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes.every(n => n.velocity === 500)).toBe(true)
    })

    it('should use bridge velocity when not overridden', () => {
      const bridge = createBridge({ velocity: 900 })
      const result = euclidean(3, 8).notes(['C4']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes.every(n => n.velocity === 900)).toBe(true)
    })
  })

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe('edge cases', () => {
    it('should return bridge unchanged when notes array is empty', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 8).notes([]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })

    it('should return bridge unchanged when pattern is invalid (steps=0)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 0).notes(['C4']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })

    it('should support fluent chaining of modifiers', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = euclidean(3, 8)
        .notes(['C4', 'E4'])
        .stepDuration(240)
        .velocity(700)
        .repeat(1)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[0].velocity).toBe(700)
    })
  })

  // ========================================================================
  // Immutability / chaining
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances', () => {
      const base = euclidean(3, 8).notes(['C4'])
      const withStepDur = base.stepDuration(240)
      const withVel = base.velocity(500)

      const bridge = createBridge({ defaultDuration: 480 })
      const baseResult = commitAndCapture(base.apply(bridge))
      const stepResult = commitAndCapture(withStepDur.apply(bridge))
      const velResult = commitAndCapture(withVel.apply(bridge))

      expect(baseResult.notes[0].duration).toBe(480)
      expect(stepResult.notes[0].duration).toBe(240)
      expect(velResult.notes[0].velocity).toBe(500)
    })
  })
})
