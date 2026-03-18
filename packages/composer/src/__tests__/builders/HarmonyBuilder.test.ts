/**
 * HarmonyBuilder Test
 *
 * Tests harmony() and chord() cues using notation-agnostic intervals and cents:
 *   - harmony(intervals, root) — interval-based emission
 *   - chord() with .intervals()/.root() — interval-based construction
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { chord } from '../../cues/chord'
import { harmony } from '../../cues/harmony'
import { note } from '../../cues/note'
import { HarmonyBuilder } from '../../builders/HarmonyBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

/** C major triad: root, M3, P5 in cents */
const MAJ = [0, 400, 700] as const
/** A minor triad */
const MIN = [0, 300, 700] as const
/** C major 7th */
const MAJ7 = [0, 400, 700, 1100] as const
/** Dominant 7th */
const DOM7 = [0, 400, 700, 1000] as const
/** Diminished triad */
const DIM = [0, 300, 600] as const

describe('HarmonyBuilder', () => {

  describe('harmony() interval-based emission', () => {
    it('harmony(MAJ7, 6000) should emit C, E, G, B (Cmaj7)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ7, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
      expect(notes[3].pitch).toBe(7100)
    })

    it('harmony(MIN, 6900) should emit A4, C5, E5 (Am)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MIN, 6900).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6900)
      expect(notes[1].pitch).toBe(7200)
      expect(notes[2].pitch).toBe(7600)
    })

    it('harmony(DOM7, 6700) should emit G4, B4, D5, F5 (G7)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(DOM7, 6700).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6700)
      expect(notes[1].pitch).toBe(7100)
      expect(notes[2].pitch).toBe(7400)
      expect(notes[3].pitch).toBe(7700)
    })

    it('harmony(DIM, 6600) should emit F#4, A4, C5 (F#dim)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(DIM, 6600).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6600)
      expect(notes[1].pitch).toBe(6900)
      expect(notes[2].pitch).toBe(7200)
    })
  })

  describe('harmony() mask and root', () => {
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
      expect(notes[3].pitch).toBe(7100)
    })

    it('harmony(MAJ, 6000) should resolve root and emit C major', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
    })
  })

  describe('root() and intervals() modifiers', () => {
    it('.root() should change chord root', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = harmony(MAJ, 6000).root(6700).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(6700) // G4
      expect(notes[1].pitch).toBe(7100)
      expect(notes[2].pitch).toBe(7400)
    })

    it('.intervals() should change chord quality', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = harmony(MAJ, 6000).intervals(MIN).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[1].pitch).toBe(6300) // Eb (minor third)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000, 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[2].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = harmony(MAJ, 6000).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('tick advance and chaining', () => {
    it('harmony then note should both emit and advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = harmony(MIN, 6000).apply(b) // C minor
      b = note(6700).apply(b) // G4

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4) // 3 from Cm + 1 from G4
      expect(notes[3].pitch).toBe(6700)
      expect(notes[3].tick).toBe(480)
    })

    it('chord(undefined) should emit no notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = chord(undefined).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = harmony(MAJ, 6000)
      const withRoot = original.root(7200)
      const withDur = original.duration(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.apply(bridge))
      const rootResult = commitAndCapture(withRoot.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))

      expect(origResult.notes[0].pitch).toBe(6000)
      expect(rootResult.notes[0].pitch).toBe(7200)
      expect(durResult.notes[0].duration).toBe(240)
      expect(origResult.notes[0].duration).toBe(480)
    })
  })
})
