/**
 * ChanceBridge Test — Bridge Decorator
 *
 * Tests ChanceBridge, a CompositionBridgeDecorator that probabilistically skips notes.
 * Each withNote() call independently rolls rng.bool(probability). If false, the note
 * is skipped (tick advances by duration). If true, the note is emitted.
 * Uses SeededRandom for reproducibility.
 *
 * Covers:
 *   - probability 1.0: always emits
 *   - probability 0.0: never emits, tick advances
 *   - deterministic behavior with same seed
 *   - tick advancement when note is skipped (with explicit duration and defaultDuration)
 *   - rewrap returns ChanceBridge instance
 */

import { describe, it, expect } from 'vitest'
import { ChanceBridge } from '../../composition/ChanceBridge'
import { createBridge, commitAndCapture } from '../test-utils'
import { SeededRandom } from '@symphonyscript/core'

describe('ChanceBridge', () => {

  function createChanceBridge(probability: number, seed: number = 42) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new ChanceBridge(bridge, probability, new SeededRandom(seed))
  }

  // ========================================================================
  // probability 1.0 — always emits
  // ========================================================================

  describe('probability 1.0', () => {
    it('should always emit when probability is 1.0', () => {
      const cb = createChanceBridge(1.0)

      const result = cb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].tick).toBe(0)
    })

    it('should emit all notes in sequence when probability is 1.0', () => {
      const cb = createChanceBridge(1.0)

      let b = cb.withNote(6000, 480)
      b = b.withNote(6200, 480)
      b = b.withNote(6400, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6200)
      expect(notes[2].pitch).toBe(6400)
    })
  })

  // ========================================================================
  // probability 0.0 — never emits, tick advances
  // ========================================================================

  describe('probability 0.0', () => {
    it('should never emit when probability is 0.0', () => {
      const cb = createChanceBridge(0.0)

      const result = cb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should advance tick when note is skipped (probability 0.0)', () => {
      const cb = createChanceBridge(0.0)

      const result = cb.withNote(6000, 480)
      expect(result.tick).toBe(480)
    })

    it('should advance tick by explicit duration when skipped', () => {
      const cb = createChanceBridge(0.0)

      const result = cb.withNote(6000, 960)
      expect(result.tick).toBe(960)
    })

    it('should use defaultDuration when duration not provided and note skipped', () => {
      const bridge = createBridge({ defaultDuration: 240, velocity: 100 })
      const cb = new ChanceBridge(bridge, 0.0, new SeededRandom(42))

      const result = cb.withNote(6000)
      expect(result.tick).toBe(240)
    })

    it('should accumulate tick advances for multiple skipped notes', () => {
      const cb = createChanceBridge(0.0)

      let b = cb.withNote(6000, 480)
      b = b.withNote(6000, 480)
      b = b.withNote(6000, 480)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(0)
      expect(b.tick).toBe(1440)
    })
  })

  // ========================================================================
  // Determinism with same seed
  // ========================================================================

  describe('determinism', () => {
    it('should produce identical results with same seed', () => {
      const cb1 = createChanceBridge(0.5, 123)
      const cb2 = createChanceBridge(0.5, 123)

      let b1 = cb1
      let b2 = cb2
      for (let i = 0; i < 8; i++) {
        b1 = b1.withNote(6000, 480)
        b2 = b2.withNote(6000, 480)
      }

      const { notes: n1 } = commitAndCapture(b1)
      const { notes: n2 } = commitAndCapture(b2)

      expect(n1.length).toBe(n2.length)
      n1.forEach((note, idx) => {
        expect(n2[idx].pitch).toBe(note.pitch)
        expect(n2[idx].tick).toBe(note.tick)
      })
    })

    it('should produce different results with different seeds', () => {
      const cb1 = createChanceBridge(0.5, 111)
      const cb2 = createChanceBridge(0.5, 222)

      let b1 = cb1
      let b2 = cb2
      for (let i = 0; i < 12; i++) {
        b1 = b1.withNote(6000, 480)
        b2 = b2.withNote(6000, 480)
      }

      const { notes: n1 } = commitAndCapture(b1)
      const { notes: n2 } = commitAndCapture(b2)

      // With different seeds and probability 0.5, we expect different outcomes
      // (not guaranteed for all seeds, but highly likely for 12 notes)
      const sameOutcome = n1.length === n2.length && n1.every((n, i) => n.tick === n2[i].tick)
      expect(sameOutcome).toBe(false)
    })
  })

  // ========================================================================
  // rewrap returns ChanceBridge
  // ========================================================================

  describe('rewrap', () => {
    it('should return ChanceBridge instance from withNote', () => {
      const cb = createChanceBridge(1.0)

      const result = cb.withNote(6000, 480)

      expect(result).toBeInstanceOf(ChanceBridge)
    })
  })
})
