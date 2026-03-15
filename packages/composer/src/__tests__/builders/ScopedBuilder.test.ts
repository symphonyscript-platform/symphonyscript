/**
 * ScopedBuilder Test — scoped(...effects) returns ScopedBuilder
 *
 * Tests the ScopedBuilder that wraps effects around steps. Interceptors
 * wrap the bridge before composition; transforms post-process after.
 * Covers:
 *   - .steps() with no effects
 *   - Interceptor effects (e.g. sustain)
 *   - Chained .steps()
 *   - No content (cascade effects as defaults)
 *   - Tick advance
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { scoped } from '../../notations/scoped'
import { note } from '../../notations/note'
import { sustain } from '../../notations/instrument'
import { createBridge, commitAndCapture } from '../test-utils'
import { ScopedBuilder } from '../../builders/ScopedBuilder'

describe('ScopedBuilder', () => {

  // ========================================================================
  // Basic steps
  // ========================================================================

  describe('basic steps', () => {
    it('should apply steps through scoped block with no effects', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped().steps(note('C4'), note('E4')).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[1].tick).toBe(480)
    })

    it('should advance tick through all steps', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = scoped().steps(note('C4'), note('E4'), note('G4')).apply(bridge)

      expect(result.tick).toBe(1440)
    })

    it('should return ScopedBuilder from scoped()', () => {
      const s = scoped()
      expect(s).toBeInstanceOf(ScopedBuilder)
      expect(typeof s.apply).toBe('function')
      expect(typeof s.steps).toBe('function')
    })
  })

  // ========================================================================
  // Interceptor effects
  // ========================================================================

  describe('interceptor effects', () => {
    it('should apply interceptor effects before steps (e.g. sustain)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped(sustain())
        .steps(note('C4'), note('E4'))
        .apply(bridge)
      const { notes, cc: capturedCC } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })
  })

  // ========================================================================
  // Chained steps
  // ========================================================================

  describe('chained steps', () => {
    it('should chain .steps() to accumulate entries', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped()
        .steps(note('C4'))
        .steps(note('E4'))
        .apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
    })
  })

  // ========================================================================
  // No content (default cascade)
  // ========================================================================

  describe('no content (default cascade)', () => {
    it('should cascade effects as defaults when no steps provided', () => {
      const bridge = createBridge()
      const result = scoped(sustain()).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should return bridge unchanged when no effects and no steps', () => {
      const bridge = createBridge({ tick: 100 })
      const result = scoped().apply(bridge)

      expect(result.tick).toBe(100)
      const { notes, cc } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(cc).toHaveLength(0)
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = scoped().steps(note('C4'))
      const withMoreSteps = original.steps(note('E4'))

      const bridge = createBridge({ defaultDuration: 480 })

      const origResult = commitAndCapture(original.apply(bridge))
      const stepsResult = commitAndCapture(withMoreSteps.apply(bridge))

      expect(origResult.notes).toHaveLength(1)
      expect(origResult.notes[0].pitch).toBe(60)

      expect(stepsResult.notes).toHaveLength(2)
      expect(stepsResult.notes[1].pitch).toBe(64)
    })
  })
})
