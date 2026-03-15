/**
 * Arpeggio Notation Test — arpeggio(pitches, rate) ArpeggioBuilder
 *
 * Tests the arpeggio() notation that emits notes in sequence
 * from the given pitch list, optionally at a specific rate.
 */

import { describe, it, expect } from 'vitest'
import { arpeggio } from '../../notations/arpeggio'
import { ArpeggioBuilder } from '../../builders/ArpeggioBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { note } from '../../notations/note'

describe('arpeggio', () => {

  describe('return type', () => {
    it('arpeggio() should return ArpeggioBuilder', () => {
      const result = arpeggio()
      expect(result).toBeInstanceOf(ArpeggioBuilder)
    })

    it('arpeggio(pitches) should return ArpeggioBuilder', () => {
      const result = arpeggio(['C4', 'E4', 'G4'])
      expect(result).toBeInstanceOf(ArpeggioBuilder)
    })

    it('arpeggio(pitches, rate) should return ArpeggioBuilder', () => {
      const result = arpeggio(['C4', 'E4', 'G4'], 240)
      expect(result).toBeInstanceOf(ArpeggioBuilder)
    })
  })

  describe('arpeggio emission', () => {
    it('arpeggio(["C4","E4","G4"]) should emit C, E, G in up pattern', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('arpeggio([60, 64, 67]) with MIDI numbers should emit same pitches', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio([60, 64, 67]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('arpeggio with rate should use rate for step duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4'], 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })
  })

  describe('empty arpeggio', () => {
    it('arpeggio() with no pitches should return bridge unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = arpeggio().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('arpeggio([]) should return bridge unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = arpeggio([]).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('chaining with note', () => {
    it('arpeggio then note should both emit', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = arpeggio(['C4', 'E4'], 480).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })
  })

  describe('sequential ticks', () => {
    it('arpeggio notes should advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = arpeggio(['C4', 'E4', 'G4'], 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
      expect(notes[2].tick).toBe(480)
    })
  })
})
