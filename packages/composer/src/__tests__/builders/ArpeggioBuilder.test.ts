/**
 * Builder Test — ArpeggioBuilder
 *
 * Tests ArpeggioBuilder (returned by `arpeggio()`), testing the builder
 * directly with createBridge + commitAndCapture.
 *
 * Covers:
 *   - Basic emission with pitches
 *   - String vs MIDI pitch resolution
 *   - .rate(), .pattern(), .gate(), .velocity(), .octaves(), .seed()
 *   - Empty arpeggio (pass-through)
 *   - Chaining with note()
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { arpeggio } from '../../notations/arpeggio'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('ArpeggioBuilder', () => {

  describe('basic emission', () => {
    it('should emit C, E, G in up pattern by default', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('should accept MIDI numbers for pitches', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio([60, 64, 67]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('should advance tick for each note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4'], 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
      expect(notes[2].tick).toBe(480)
    })
  })

  describe('.rate()', () => {
    it('should use rate for step duration when set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).rate(240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })
  })

  describe('.pattern()', () => {
    it('down pattern should emit notes in reverse order', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).pattern('down').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(67)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(60)
    })

    it('up pattern should emit notes ascending', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).pattern('up').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })
  })

  describe('.velocity()', () => {
    it('should use builder velocity when set', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).velocity(900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(900)
    })
  })

  describe('.gate()', () => {
    it('should scale note duration by gate', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).rate(480).gate(0.5).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240) // 480 * 0.5
    })
  })

  describe('empty arpeggio', () => {
    it('should pass through bridge unchanged when no pitches', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = arpeggio().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('arpeggio([]) should pass through bridge unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = arpeggio([]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('chaining with note()', () => {
    it('arpeggio then note should both emit', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = arpeggio(['C4', 'E4']).rate(480).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = arpeggio(['C4', 'E4', 'G4'])
      const withPattern = original.pattern('down')
      const withRate = original.rate(120)

      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const origResult = commitAndCapture(original.apply(bridge))
      const patternResult = commitAndCapture(withPattern.apply(bridge))
      const rateResult = commitAndCapture(withRate.apply(bridge))

      expect(origResult.notes[0].pitch).toBe(60)
      expect(patternResult.notes[0].pitch).toBe(67)
      expect(rateResult.notes[0].duration).toBe(120)
    })
  })
})
