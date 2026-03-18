/**
 * Chord cue Test — chord(symbol, duration) HarmonyBuilder
 *
 * Tests the chord() cue that parses a chord symbol and returns
 * a HarmonyBuilder which emits chord tones when applied.
 */

import { describe, it, expect } from 'vitest'
import { chord } from '../../cues/chord'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

describe('chord', () => {

  describe('return type', () => {
    it('chord() should return HarmonyBuilder', () => {
      const result = chord()
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('chord(symbol) should return HarmonyBuilder', () => {
      const result = chord('Cmaj7')
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('chord(symbol, duration) should return HarmonyBuilder', () => {
      const result = chord('Am', 240)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })
  })

  describe.skip('chord symbol parsing and emission', () => {
    it('chord("Cmaj7") should emit C, E, G, B (pitches 60, 64, 67, 71)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('Cmaj7').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
      expect(notes[3].pitch).toBe(7100)
    })

    it('chord("Am") should emit A4, C5, E5 (pitches 69, 72, 76)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('Am').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6900)
      expect(notes[1].pitch).toBe(7200)
      expect(notes[2].pitch).toBe(7600)
    })

    it('chord(10300) should emit G4, B4, D5, F5 (pitches 67, 71, 74, 77)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord(10300).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6700)
      expect(notes[1].pitch).toBe(7100)
      expect(notes[2].pitch).toBe(7400)
      expect(notes[3].pitch).toBe(7700)
    })

    it('chord("F#dim") should emit F#, A, C (pitches 66, 69, 72)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('F#dim').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6600)
      expect(notes[1].pitch).toBe(6900)
      expect(notes[2].pitch).toBe(7200)
    })

    it('chord("Cm") with note() chained after should advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = chord('Cm').apply(bridge)
      b = chord('Cm').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(6)
    })
  })

  describe('duration', () => {
    it.skip('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('C', 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })

    it.skip('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('C').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('chord(undefined)', () => {
    it('chord(undefined) should return builder with mask 0 (no notes emitted)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chord(undefined).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })
})
