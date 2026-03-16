/**
 * Harmony Notation Test — harmony(mask, root?, duration?) HarmonyBuilder
 *
 * Tests the harmony() notation that takes a HarmonyMask and optional root/duration,
 * returning a HarmonyBuilder which emits chord tones when applied.
 */

import { describe, it, expect } from 'vitest'
import { harmony } from '../../cues/harmony'
import { note } from '../../cues/note'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { CHORD } from '@symphonyscript/theory'

describe('harmony', () => {

  describe('return type', () => {
    it('harmony() should return HarmonyBuilder', () => {
      const result = harmony()
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('harmony(mask) should return HarmonyBuilder', () => {
      const result = harmony(CHORD.MAJ)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })

    it('harmony(mask, root, duration) should return HarmonyBuilder', () => {
      const result = harmony(CHORD.MAJ, 60, 240)
      expect(result).toBeInstanceOf(HarmonyBuilder)
    })
  })

  describe('harmony mask and root', () => {
    it('harmony(CHORD.MAJ, 60) should emit C major triad (60, 64, 67)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MAJ, 60).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
    })

    it('harmony(CHORD.MIN, 69) should emit A minor triad (69, 72, 76)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MIN, 69).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(69)
      expect(notes[1].pitch).toBe(72)
      expect(notes[2].pitch).toBe(76)
    })

    it('harmony(CHORD.MAJ7, 60) should emit Cmaj7 (60, 64, 67, 71)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MAJ7, 60).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[3].pitch).toBe(71)
    })

    it('harmony(CHORD.MAJ, "C4") should resolve root and emit C major', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MAJ, 'C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MAJ, 60, 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(CHORD.MAJ, 60).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('chaining with note', () => {
    it('harmony then note should both emit', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmony(CHORD.MAJ, 60).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)
      expect(notes[3].pitch).toBe(67)
    })
  })
})
