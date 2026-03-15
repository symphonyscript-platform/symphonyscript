/**
 * TremoloBuilder Test — melody.tremolo(pitch, rate, duration)
 *
 * Rapid repeated note. Emits multiple hits at given rate over duration.
 */

import { describe, it, expect } from 'vitest'
import { tremolo } from '../../notations/melody'
import { TremoloBuilder } from '../../builders/TremoloBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

describe('TremoloBuilder', () => {

  describe('return type', () => {
    it('tremolo() should return TremoloBuilder', () => {
      const result = tremolo()
      expect(result).toBeInstanceOf(TremoloBuilder)
    })

    it('tremolo("C4", 120, 480) should return TremoloBuilder', () => {
      const result = tremolo('C4', 120, 480)
      expect(result).toBeInstanceOf(TremoloBuilder)
    })
  })

  describe('tremolo emission', () => {
    it('should emit repeated notes at given rate over duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tremolo('C4', 120, 480).apply(bridge)
      const { notes } = commitAndCapture(result)

      // 480 / 120 = 4 hits
      expect(notes).toHaveLength(4)
      notes.forEach(n => {
        expect(n.pitch).toBe(60)
        expect(n.duration).toBe(120)
      })
    })

    it('should advance tick by total duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = tremolo('C4', 120, 480).apply(bridge)
      expect(result.tick).toBe(480)
    })

    it('should space hits sequentially', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tremolo('E4', 240, 480).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].pitch).toBe(64)
      expect(notes[1].tick).toBe(240)
      expect(notes[1].pitch).toBe(64)
    })

    it('should use bridge defaultDuration for rate and duration when omitted', () => {
      const bridge = createBridge({ defaultDuration: 120 })
      const result = tremolo('G4').apply(bridge)
      const { notes } = commitAndCapture(result)

      // rate=120, duration=120 -> 1 hit
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(67)
      expect(notes[0].duration).toBe(120)
    })
  })

  describe('no-op when pitch missing', () => {
    it('tremolo() without pitch should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = tremolo().apply(bridge)
      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('builder chaining', () => {
    it('.pitch() should set pitch', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tremolo(undefined, 120, 480)
        .pitch('A4')
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      notes.forEach(n => expect(n.pitch).toBe(69))
    })

    it('.rate() should set hit rate', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tremolo('C4', 240, 480)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(240)
    })

    it('.duration() should set total duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tremolo('C4', 120)
        .duration(240)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
    })
  })

  describe('immutability', () => {
    it('.pitch(), .rate(), .duration() should return new instances', () => {
      const base = tremolo('C4', 120, 480)
      const withPitch = base.pitch('E4')
      const withRate = base.rate(240)
      const withDuration = base.duration(240)

      expect(withPitch).not.toBe(base)
      expect(withRate).not.toBe(base)
      expect(withDuration).not.toBe(base)

      const bridge = createBridge({ defaultDuration: 480 })
      const baseNotes = commitAndCapture(base.apply(bridge)).notes
      const pitchNotes = commitAndCapture(withPitch.apply(bridge)).notes
      expect(pitchNotes[0].pitch).toBe(64) // E4
      expect(baseNotes[0].pitch).toBe(60) // C4
    })
  })
})
