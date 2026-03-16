/**
 * GlissandoBuilder Test — melody.glissando() returns GlissandoBuilder
 *
 * Tests the GlissandoBuilder that emits chromatic slide notes from one
 * pitch to another. Covers:
 *   - Ascending chromatic slide
 *   - Descending chromatic slide
 *   - Same pitch (single note)
 *   - Duration from bridge or explicit
 *   - Null from/to pass-through
 *   - Builder chaining (.from(), .to(), .duration())
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { glissando } from '../../cues/melody'
import { createBridge, commitAndCapture } from '../test-utils'
import { GlissandoBuilder } from '../../builders/GlissandoBuilder'

describe('GlissandoBuilder', () => {

  // ========================================================================
  // Basic emission
  // ========================================================================

  describe('basic emission', () => {
    it('glissando(from, to, duration) should emit chromatic slide', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = glissando('C4', 'E4', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      // C4=60, E4=64 -> 4 semitones, 5 notes (60,61,62,63,64)
      expect(notes).toHaveLength(5)
      expect(notes[0].pitch).toBe(60)
      expect(notes[notes.length - 1].pitch).toBe(64)
      expect(notes[1].pitch).toBe(61)
      expect(notes[2].pitch).toBe(62)
    })

    it('glissando downward should emit descending chromatic notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('G4', 'C4', 200).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(67)
      expect(notes[notes.length - 1].pitch).toBe(60)
    })

    it('glissando same pitch should emit single note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'C4', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })
  })

  // ========================================================================
  // Duration
  // ========================================================================

  describe('duration', () => {
    it('should use bridge defaultDuration when duration omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'D4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      notes.forEach((n) => expect(n.duration).toBeGreaterThan(0))
    })

    it('.duration() should override constructor duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'E4', 480).duration(120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(5)
      expect(notes[0].duration).toBe(30)
    })
  })

  // ========================================================================
  // Null from/to
  // ========================================================================

  describe('null from/to', () => {
    it('glissando without from/to should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 50 })
      const result = glissando().apply(bridge)

      expect(result.tick).toBe(50)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  // ========================================================================
  // Builder methods
  // ========================================================================

  describe('builder methods', () => {
    it('.from() .to() .duration() should chain', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando()
        .from('C4')
        .to('G4')
        .duration(360)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(8)
      expect(notes[0].pitch).toBe(60)
      expect(notes[notes.length - 1].pitch).toBe(67)
    })
  })

  // ========================================================================
  // Tick advance
  // ========================================================================

  describe('tick advance', () => {
    it('notes should be spaced sequentially', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glissando('C4', 'E4', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      const stepDuration = Math.round(240 / 4)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(stepDuration)
    })

    it('should advance bridge tick', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = glissando('C4', 'E4', 240).apply(bridge)

      expect(result.tick).toBeGreaterThan(0)
    })
  })

  // ========================================================================
  // Return type
  // ========================================================================

  describe('return type', () => {
    it('glissando() should return GlissandoBuilder', () => {
      const result = glissando()
      expect(result).toBeInstanceOf(GlissandoBuilder)
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = glissando('C4', 'D4')
      const withTo = original.to('E4')
      const withDuration = original.duration(100)

      const bridge = createBridge({ defaultDuration: 480 })

      const origResult = commitAndCapture(original.apply(bridge))
      const toResult = commitAndCapture(withTo.apply(bridge))
      const durResult = commitAndCapture(withDuration.apply(bridge))

      expect(origResult.notes).toHaveLength(3)
      expect(toResult.notes).toHaveLength(5)
      expect(origResult.notes[origResult.notes.length - 1].pitch).toBe(62)
      expect(toResult.notes[toResult.notes.length - 1].pitch).toBe(64)
    })
  })
})
