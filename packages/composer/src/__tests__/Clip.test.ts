/**
 * Tests for Clip.
 *
 * Covers:
 *   - Clip.pipe(...steps) - static factory
 *   - compose(context) - applies steps sequentially
 *   - pipe() chaining - concatenates steps
 *   - Clip.freeze() - delegates to freeze utility
 */

import { describe, it, expect } from 'vitest'
import { Clip } from '../Clip'
import { note } from '../cues/note'
import { createBridge, commitAndCapture, testNotation } from './test-utils'

describe('Clip', () => {

  describe('Clip.pipe', () => {
    it('should create a Clip with the given steps', () => {
      const clip = Clip.pipe(note(6000))
      const bridge = createBridge()
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })

    it('should create a Clip with multiple steps', () => {
      const clip = Clip.pipe(note(6000), note(6400), note(6700))
      const bridge = createBridge()
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
    })

    it('should create an empty Clip when no steps provided', () => {
      const clip = Clip.pipe()
      const bridge = createBridge()
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(0)
    })
  })

  describe('compose', () => {
    it('should apply steps sequentially, advancing tick between each', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const clip = Clip.pipe(note(6000), note(6400), note(6700))
      const result = clip.compose(bridge)

      expect(result.tick).toBe(1440) // 3 × 480

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
      expect(notes[2].tick).toBe(960)
    })

    it('should pass bridge state (velocity, etc.) through the pipeline', () => {
      const bridge = createBridge({ velocity: 900 })
      const clip = Clip.pipe(note(6000))
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(900)
    })
  })

  describe('pipe chaining', () => {
    it('should return a new Clip with concatenated steps', () => {
      const clip = Clip.pipe(note(6000)).pipe(note(6400)).pipe(note(6700))
      const bridge = createBridge()
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)
    })

    it('should not mutate the original clip', () => {
      const original = Clip.pipe(note(6000))
      const chained = original.pipe(note(6400))

      const bridge = createBridge()
      const origResult = commitAndCapture(original.compose(bridge))
      const chainResult = commitAndCapture(chained.compose(bridge))

      expect(origResult.notes).toHaveLength(1)
      expect(chainResult.notes).toHaveLength(2)
    })
  })

  describe('Clip.freeze', () => {
    it('should freeze a clip and return IFrozenClip', () => {
      const clip = Clip.pipe(note(6000), note(6400))
      const frozen = Clip.freeze(clip, testNotation)

      expect(frozen).toBeDefined()
      expect(frozen.noteCount).toBe(2)
      expect(typeof frozen.visitNotes).toBe('function')
    })
  })
})
