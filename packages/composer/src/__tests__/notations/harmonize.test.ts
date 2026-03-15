/**
 * Harmonize Notation Test — harmonize(...intervals) adds harmony voices
 *
 * Tests the harmonize() notation that wraps the bridge in HarmonizeBridge,
 * adding diatonic harmony voices at the given intervals.
 */

import { describe, it, expect } from 'vitest'
import { harmonize } from '../../notations/harmonize'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('harmonize', () => {

  describe('harmonize(...intervals) adds harmony voices', () => {
    it('should add third and fifth for C4 with intervals [3, 5]', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize(3, 5).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60) // C4 melody
      expect(notes[1].pitch).toBe(64) // E4 (degree 3)
      expect(notes[2].pitch).toBe(67) // G4 (degree 5)
    })

    it('should produce only melody when intervals is empty', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize().apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })

    it('should add single third with intervals [3]', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize(3).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
    })

    it('should add third, fifth, octave with intervals [3, 5, 8]', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize(3, 5, 8).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      expect(notes[3].pitch).toBe(72)
    })

    it('should emit all harmony notes at same tick as melody', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize(3, 5).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
    })

    it('should affect only notes inside harmonize scope', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = harmonize(3, 5).apply(bridge)
      b = note('C4').apply(b)
      b = note('E4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(6) // 3 for C4 + 3 for E4
      expect(notes[0].pitch).toBe(60)
      expect(notes[3].pitch).toBe(64)
    })
  })
})
