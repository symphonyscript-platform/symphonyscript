/**
 * Tests for degree cue.
 *
 * Covers:
 *   - degree(n, duration) returns DegreeBuilder
 *   - degree(1) in C major = C4 (pitch 60)
 *   - degree(5) in C major = G4 (pitch 67)
 *   - duration parameter
 */

import { describe, it, expect } from 'vitest'
import { degree } from '../../cues/degree'
import { DegreeBuilder } from '../../builders/DegreeBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

describe('degree', () => {

  describe('return type', () => {
    it('degree(n) should return DegreeBuilder', () => {
      const result = degree(1)
      expect(result).toBeInstanceOf(DegreeBuilder)
    })

    it('degree(n, duration) should return DegreeBuilder', () => {
      const result = degree(3, 240)
      expect(result).toBeInstanceOf(DegreeBuilder)
    })
  })

  describe('scale degree resolution', () => {
    it('degree(1) in C major should resolve to C4 (pitch 60)', () => {
      const bridge = createBridge({ scaleRootCents: 6000 }) // C4
      const result = degree(1).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000) // C4
    })

    it('degree(5) in C major should resolve to G4 (pitch 67)', () => {
      const bridge = createBridge({ scaleRootCents: 6000 }) // C4
      const result = degree(5).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6700) // G4
    })

    it('degree(1) with default bridge (C major) should be C4', () => {
      const bridge = createBridge({ scaleRootCents: 6000 })
      const result = degree(1).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].pitch).toBe(6000)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1, 240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(480)
    })
  })
})
