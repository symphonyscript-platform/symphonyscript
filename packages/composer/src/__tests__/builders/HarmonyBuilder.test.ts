/**
 * HarmonyBuilder Test
 *
 * Tests chord() and harmony() notations:
 *   - chord() chord symbol parsing
 *   - harmony() mask/root
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { chord } from '../../cues/chord'
import { harmony } from '../../cues/harmony'
import { note } from '../../cues/note'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { CHORD } from '@symphonyscript/theory'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('HarmonyBuilder', () => {

  describe('chord() symbol parsing', () => {
    it('chord("Cmaj7") should emit C, E, G, B (pitches 60, 64, 67, 71)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('Cmaj7').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[3].pitch).toBe(71)
    })

    it('chord("Am") should emit A4, C5, E5 (pitches 69, 72, 76)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('Am').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(69)
      expect(notes[1].pitch).toBe(72)
      expect(notes[2].pitch).toBe(76)
    })

    it('chord("G7") should emit G4, B4, D5, F5 (pitches 67, 71, 74, 77)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('G7').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(67)
      expect(notes[1].pitch).toBe(71)
      expect(notes[2].pitch).toBe(74)
      expect(notes[3].pitch).toBe(77)
    })

    it('chord("F#dim") should emit F#, A, C (pitches 66, 69, 72)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('F#dim').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(66)
      expect(notes[1].pitch).toBe(69)
      expect(notes[2].pitch).toBe(72)
    })
  })

  describe('harmony() mask and root', () => {
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

  describe('mask() and root() modifiers', () => {
    it('.root() should change chord root', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = harmony(CHORD.MAJ, 60).root(67).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(67) // G4
      expect(notes[1].pitch).toBe(71)
      expect(notes[2].pitch).toBe(74)
    })

    it('.mask() should change chord quality', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = harmony(CHORD.MAJ, 60).mask(CHORD.MIN).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[1].pitch).toBe(63) // Eb (minor third)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = chord('C', 240).apply(bridge)

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

  describe('tick advance and chaining', () => {
    it('harmony then note should both emit and advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = chord('Cm').apply(b)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4) // 3 from Cm + 1 from G4
      expect(notes[3].pitch).toBe(67)
      expect(notes[3].tick).toBe(480)
    })

    it('chord(undefined) should emit no notes (mask 0)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chord(undefined).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = harmony(CHORD.MAJ, 60)
      const withRoot = original.root(72)
      const withDur = original.duration(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.apply(bridge))
      const rootResult = commitAndCapture(withRoot.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))

      expect(origResult.notes[0].pitch).toBe(60)
      expect(rootResult.notes[0].pitch).toBe(72)
      expect(durResult.notes[0].duration).toBe(240)
      expect(origResult.notes[0].duration).toBe(480)
    })
  })
})
