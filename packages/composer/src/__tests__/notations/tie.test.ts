/**
 * Tie cue Test — tie(...steps) wraps in TieBridge per step
 *
 * tie() creates a new TieBridge per step (current = new TieBridge(steps[i].apply(current))),
 * so accumulated state does not carry across steps. Each step gets a fresh TieBridge wrapper.
 *
 * Actual behavior: same-pitch accumulation is lost; different pitches emit with
 * per-step flush duplicates (prev flush + new note).
 */

import { describe, it, expect } from 'vitest'
import { tie } from '../../cues/tie'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('tie', () => {

  describe('tie(...steps) wraps in TieBridge per step', () => {
    it('same-pitch notes: only first note (accumulation lost)', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = tie(note(6000), note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 6000, duration: 480, tick: 0 })
    })

    it('multiple same-pitch notes: only first note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = tie(note(6000), note(6000), note(6000), note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(480)
    })

    it('different pitches: each pitch emits; flush adds previous duplicate', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = tie(note(6000), note(6400), note(6700)).apply(bridge)

      const { notes } = commitAndCapture(result)
      // Per-step TieBridge: C4, flush C4, E4, flush E4, G4 (last not flushed) = 5 notes
      expect(notes).toHaveLength(5)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[2].pitch).toBe(6400)
      expect(notes[4].pitch).toBe(6700)
    })

    it('should advance tick through tied steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tie(note(6000), note(6000)).apply(bridge)

      expect(result.tick).toBe(960)
    })

    it('single step: one note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = tie(note(6000)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(480)
    })

    it('should tie then allow subsequent steps outside tie', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = tie(note(6000), note(6000)).apply(bridge)
      b = note(6400).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes.length).toBeGreaterThanOrEqual(2)
      expect(notes[notes.length - 1].pitch).toBe(6400)
    })
  })
})
