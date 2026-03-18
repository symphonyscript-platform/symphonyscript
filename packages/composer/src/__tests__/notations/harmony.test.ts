/**
 * Harmony cue Test — harmony(mask, root?, duration?) HarmonyBuilder
 *
 * Tests the harmony() cue that takes a HarmonyMask and optional root/duration,
 * returning a HarmonyBuilder which emits chord tones when applied.
 */

import { describe, it, expect } from 'vitest'
import { harmony } from '../../cues/harmony'
import { note } from '../../cues/note'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
/** C major triad in cents */
const MAJ = [0, 400, 700] as const
const MIN = [0, 300, 700] as const
const MAJ7 = [0, 400, 700, 1100] as const

describe('harmony', () => {

  describe('return type', () => {
    it('harmony() should return HarmonyBuilder', () => {
      const result = harmony()
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('harmony(mask) should return HarmonyBuilder', () => {
      const result = harmony(MAJ)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('harmony(mask, root, duration) should return HarmonyBuilder', () => {
      const result = harmony(MAJ, 6000, 240)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })
  })

  describe('harmony mask and root', () => {
    it('harmony(MAJ, 6000) should emit C major triad', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
    })

    it('harmony(MIN, 6900) should emit A minor triad', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MIN, 6900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6900)
      expect(notes[1].pitch).toBe(7200)
      expect(notes[2].pitch).toBe(7600)
    })

    it('harmony(MAJ7, 6000) should emit Cmaj7', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ7, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
      expect(notes[3].pitch).toBe(7100)
    })

    it('harmony(MAJ, "C4") should resolve root and emit C major', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 'C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000, 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('chaining with note', () => {
    it('harmony then note should both emit', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmony(MAJ, 6000).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[3].pitch).toBe(6700)
    })
  })
})
