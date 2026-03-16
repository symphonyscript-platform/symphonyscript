/**
 * TupletBuilder Test
 *
 * Tests tuplet(count, inBeats) — fit N notes in M beats:
 *   - tuplet(3, 2) fits 3 notes in 2 beats
 *   - steps() with note builders
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { tuplet } from '../../cues/melody'
import { note } from '../../cues/note'
import { TupletBuilder } from '../../builders/TupletBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('TupletBuilder', () => {

  describe('tuplet(3, 2) fit 3 notes in 2 beats', () => {
    it('tuplet(3, 2).steps(note, note, note) should emit 3 notes in 2 beat span', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      // 2 beats = 2 * 480 = 960 ticks total
      // Each note gets 960/3 = 320 ticks
      const result = tuplet(3, 2)
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)

      // Each note has scaled duration = 960/3 = 320
      expect(notes[0].duration).toBe(320)
      expect(notes[1].duration).toBe(320)
      expect(notes[2].duration).toBe(320)

      // Ticks: 0, 320, 640 — total span 640 + 320 = 960 = 2 beats
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(320)
      expect(notes[2].tick).toBe(640)

      expect(result.tick).toBe(960)
    })

    it('tuplet(3, 2) with defaultDuration 240 should scale correctly', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = tuplet(3, 2)
        .steps(note('C4'), note('D4'), note('E4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      // 2 * 240 = 480 total, 480/3 = 160 per note
      expect(notes[0].duration).toBe(160)
      expect(notes[1].duration).toBe(160)
      expect(notes[2].duration).toBe(160)
      expect(result.tick).toBe(480)
    })
  })

  describe('count and inBeats modifiers', () => {
    it('.count(4).inBeats(3) should fit 4 notes in 3 beats', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tuplet(3, 2)
        .count(4)
        .inBeats(3)
        .steps(note('C4'), note('D4'), note('E4'), note('F4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      // 3 * 480 = 1440, 1440/4 = 360 per note
      expect(notes).toHaveLength(4)
      expect(notes[0].duration).toBe(360)
      expect(result.tick).toBe(1440)
    })
  })

  describe('edge cases', () => {
    it('tuplet with empty steps should emit nothing and not advance', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tuplet(3, 2).steps().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(0)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = tuplet(3, 2).steps(note('C4'), note('E4'), note('G4'))
      const withCount = original.count(4)
      const withBeats = original.inBeats(3)

      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.apply(bridge))
      const countResult = commitAndCapture(
        withCount.steps(note('C4'), note('D4'), note('E4'), note('F4')).apply(bridge),
      )

      expect(origResult.notes).toHaveLength(3)
      expect(countResult.notes).toHaveLength(4)
    })
  })

  describe('chaining with note', () => {
    it('tuplet then note should advance tick and emit both', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = tuplet(3, 2).steps(note('C4'), note('E4'), note('G4')).apply(b)
      b = note('C5').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(4)
      expect(notes[3].pitch).toBe(72)
      expect(notes[3].tick).toBe(960)
    })
  })
})
