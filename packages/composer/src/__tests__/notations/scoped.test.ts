/**
 * Scoped cue Test — scoped(...effects) composes effects into one block
 *
 * ScopedBuilder wraps effects around steps. Interceptors wrap the bridge before
 * composition; transforms post-process after composition.
 */

import { describe, it, expect } from 'vitest'
import { scoped } from '../../cues/scoped'
import { note } from '../../cues/note'
import { sustain } from '../../cues/instrument'
import { createBridge, commitAndCapture } from '../test-utils'

describe('scoped', () => {

  describe('scoped(...effects).steps(...pipeSteps)', () => {
    it('should apply steps through scoped block with no effects', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped().steps(note('C4'), note('E4')).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[1].tick).toBe(480)
    })

    it('should apply interceptor effects before steps (e.g. sustain)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped(sustain())
        .steps(note('C4'), note('E4'))
        .apply(bridge)
      const { notes, cc: capturedCC } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should advance tick through all steps', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = scoped().steps(note('C4'), note('E4'), note('G4')).apply(bridge)

      expect(result.tick).toBe(1440)
    })

    it('should chain .steps() to accumulate entries', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = scoped()
        .steps(note('C4'))
        .steps(note('E4'))
        .apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
    })

    it('should return ScopedBuilder from scoped()', () => {
      const s = scoped()
      expect(s).toBeDefined()
      expect(typeof s.apply).toBe('function')
      expect(typeof s.steps).toBe('function')
    })
  })

  describe('scoped() with no content (no steps)', () => {
    it('should cascade effects as defaults when no steps provided', () => {
      const bridge = createBridge()
      const result = scoped(sustain()).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should return bridge unchanged when no effects and no steps', () => {
      const bridge = createBridge({ tick: 100 })
      const result = scoped().apply(bridge)

      expect(result.tick).toBe(100)
      const { notes, cc } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(cc).toHaveLength(0)
    })
  })
})
