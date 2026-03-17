/**
 * HarmonizeBridge Test — Bridge Decorator
 *
 * Tests HarmonizeBridge, a CompositionBridgeDecorator that adds harmonizing
 * voices at diatonic intervals. Uses degreeToPitch, scaleRoot, scaleMode.
 *
 * Covers:
 *   - Single note produces melody + harmony notes
 *   - intervals param (different diatonic intervals)
 *   - Precise bypass skips harmonization
 */

import { describe, it, expect } from 'vitest'
import { HarmonizeBridge } from '../../composition/HarmonizeBridge'
import { createBridge, commitAndCapture } from '../test-utils'
import { ScaleMode } from '@symphonyscript/notations'

describe('HarmonizeBridge', () => {

  function createHarmonizeBridge(
    intervals: readonly number[],
    opts: { scaleRoot?: number; scaleMode?: ScaleMode } = {},
  ) {
    const bridge = createBridge({
      defaultDuration: 480,
      velocity: 100,
      scaleRoot: opts.scaleRoot ?? 0,
      scaleMode: opts.scaleMode ?? ScaleMode.MAJOR,
    })
    return new HarmonizeBridge(bridge, { intervals })
  }

  // ========================================================================
  // Single note produces melody + harmony
  // ========================================================================

  describe('single note produces melody + harmony notes', () => {
    it('should add third and fifth for C4 in C major with intervals [3, 5]', () => {
      const hb = createHarmonizeBridge([3, 5])

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      // Melody: C4 = 60
      expect(notes[0].pitch).toBe(60)
      // Harmony degree 3: E4 = 64
      expect(notes[1].pitch).toBe(64)
      // Harmony degree 5: G4 = 67
      expect(notes[2].pitch).toBe(67)
    })

    it('should produce only melody when intervals is empty', () => {
      const hb = createHarmonizeBridge([])

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })

    it('should emit all harmony notes at same tick as melody', () => {
      const hb = createHarmonizeBridge([3, 5])

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
    })
  })

  // ========================================================================
  // intervals param
  // ========================================================================

  describe('intervals param', () => {
    it('should add single third with intervals [3]', () => {
      const hb = createHarmonizeBridge([3])

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)   // C4
      expect(notes[1].pitch).toBe(64)   // E4
    })

    it('should add third, fifth, and octave with intervals [3, 5, 8]', () => {
      const hb = createHarmonizeBridge([3, 5, 8])

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60)   // C4
      expect(notes[1].pitch).toBe(64)   // E4
      expect(notes[2].pitch).toBe(67)   // G4
      expect(notes[3].pitch).toBe(72)   // C5 (octave)
    })

    it('should respect scaleRoot and scaleMode for harmonization', () => {
      const hb = createHarmonizeBridge([3, 5], {
        scaleRoot: 7,  // G
        scaleMode: ScaleMode.MAJOR,
      })

      // G4 = 67, degree 1 in G major
      const result = hb.withNote(67, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(67)   // G4
      expect(notes[1].pitch).toBe(71)   // B4 (degree 3 in G major)
      expect(notes[2].pitch).toBe(74)   // D5 (degree 5 in G major)
    })
  })

  // ========================================================================
  // Precise bypass
  // ========================================================================

  describe('precise bypass', () => {
    it('should skip harmonization when precise flag is set', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        velocity: 100,
        scaleRoot: 0,
        scaleMode: ScaleMode.MAJOR,
        precise: true,
      })
      const hb = new HarmonizeBridge(bridge, { intervals: [3, 5] })

      const result = hb.withNote(60, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
    })
  })
})
