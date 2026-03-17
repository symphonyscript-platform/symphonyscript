/**
 * HarmonizeBridge Test — Bridge Decorator
 *
 * Tests HarmonizeBridge, a CompositionBridgeDecorator that adds harmonizing
 * voices at diatonic intervals. Uses cents-based scaleRootCents + scaleIntervals.
 *
 * Covers:
 *   - Single note produces melody + harmony notes
 *   - intervals param (different diatonic intervals)
 *   - Precise bypass skips harmonization
 */

import { describe, it, expect } from 'vitest'
import { HarmonizeBridge } from '../../composition/HarmonizeBridge'
import { createBridge, commitAndCapture } from '../test-utils'

/** C major scale intervals in cents */
const MAJOR_INTERVALS = [0, 200, 400, 500, 700, 900, 1100]

describe('HarmonizeBridge', () => {

  function createHarmonizeBridge(
    intervals: readonly number[],
    opts: {
      scaleRootCents?: number
      scaleIntervals?: readonly number[]
    } = {},
  ) {
    const bridge = createBridge({
      defaultDuration: 480,
      velocity: 100,
      scaleRootCents: opts.scaleRootCents ?? 6000, // C4
      scaleIntervals: opts.scaleIntervals ?? MAJOR_INTERVALS,
    })
    return new HarmonizeBridge(bridge, { intervals })
  }

  // ========================================================================
  // Single note produces melody + harmony
  // ========================================================================

  describe('single note produces melody + harmony notes', () => {
    it('should add third and fifth for C4 in C major with intervals [3, 5]', () => {
      // scaleRootCents=6000 (C4), pitch=6000 → degree 1
      // degree 3 = 6000 + 400 = 6400 (E4)
      // degree 5 = 6000 + 700 = 6700 (G4)
      const hb = createHarmonizeBridge([3, 5])

      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)  // C4
      expect(notes[1].pitch).toBe(6400)  // E4 (degree 3)
      expect(notes[2].pitch).toBe(6700)  // G4 (degree 5)
    })

    it('should produce only melody when intervals is empty', () => {
      const hb = createHarmonizeBridge([])

      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })

    it('should emit all harmony notes at same tick as melody', () => {
      const hb = createHarmonizeBridge([3, 5])

      const result = hb.withNote(6000, 480)
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

      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)  // C4
      expect(notes[1].pitch).toBe(6400)  // E4
    })

    it('should add third, fifth, and octave with intervals [3, 5, 8]', () => {
      const hb = createHarmonizeBridge([3, 5, 8])

      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(6000)  // C4
      expect(notes[1].pitch).toBe(6400)  // E4
      expect(notes[2].pitch).toBe(6700)  // G4
      expect(notes[3].pitch).toBe(7200)  // C5 (octave)
    })

    it('should respect scaleRootCents for harmonization', () => {
      // G major: root at G4 = 6700 cents
      const hb = createHarmonizeBridge([3, 5], {
        scaleRootCents: 6700,
        scaleIntervals: MAJOR_INTERVALS,
      })

      // G4 = 6700 cents → degree 1 in G major (scaleRoot 6700)
      // degree 3 = 6700 + 400 = 7100 (B4)
      // degree 5 = 6700 + 700 = 7400 (D5)
      const result = hb.withNote(6700, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6700)  // G4
      expect(notes[1].pitch).toBe(7100)  // B4 (degree 3 in G major)
      expect(notes[2].pitch).toBe(7400)  // D5 (degree 5 in G major)
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
        scaleRootCents: 6000,
        scaleIntervals: MAJOR_INTERVALS,
        precise: true,
      })
      const hb = new HarmonizeBridge(bridge, { intervals: [3, 5] })

      const result = hb.withNote(6000, 480)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })
  })
})
