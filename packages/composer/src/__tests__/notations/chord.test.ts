/**
 * Chord cue Test — chord() + .intervals()/.root() HarmonyBuilder
 *
 * Tests the chord() cue used with notation-agnostic intervals and cents.
 * chord(symbol) is notation-specific and not tested here; use harmony() instead.
 */

import { describe, it, expect } from 'vitest'
import { chord } from '../../cues/chord'
import { harmony } from '../../cues/harmony'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

/** C major triad */
const MAJ = [0, 400, 700] as const
/** Minor triad */
const MIN = [0, 300, 700] as const

describe('chord', () => {

  describe('return type', () => {
    it('chord() should return HarmonyBuilder', () => {
      const result = chord()
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('chord().intervals(MAJ).root(6000) should return HarmonyBuilder', () => {
      const result = chord().intervals(MAJ).root(6000)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('chord().intervals(MAJ).root(6000).duration(240) should return HarmonyBuilder', () => {
      const result = chord().intervals(MAJ).root(6000).duration(240)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })
  })

  describe('interval-based emission via chord().intervals().root()', () => {
    it('chord().intervals(MAJ).root(6000) should emit C, E, G', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord().intervals(MAJ).root(6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
    })

    it('chord().intervals(MIN).root(6900) should emit A4, C5, E5 (Am)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord().intervals(MIN).root(6900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6900)
      expect(notes[1].pitch).toBe(7200)
      expect(notes[2].pitch).toBe(7600)
    })

    it('chord().intervals(MIN).root(6000) chained twice should emit 6 notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = chord().intervals(MIN).root(6000).apply(bridge)
      b = chord().intervals(MIN).root(6000).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(6)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000, 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord().intervals(MAJ).root(6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('chord(undefined)', () => {
    it('chord(undefined) should emit no notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chord(undefined).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })
})
