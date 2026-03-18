/**
 * Use cue Test — use(clip) LinkBuilder inserts another clip's content
 *
 * use(clip) returns LinkBuilder for configuration (weight, effects).
 * Without effects, clip content is composed at the current tick.
 */

import { describe, it, expect } from 'vitest'
import { use } from '../../cues/use'
import { note } from '../../cues/note'
import { Clip } from '../../Clip'
import { sustain } from '../../cues/instrument'
import { scoped } from '../../cues/scoped'
import { createBridge, commitAndCapture } from '../test-utils'

describe('use', () => {

  describe('use(clip)', () => {
    it('should insert clip content at current tick', () => {
      const clip = Clip.pipe(note('C4'), note('E4'))
      const bridge = createBridge({ defaultDuration: 480 })
      const result = use(clip).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })

    it('should advance bridge tick after clip composition', () => {
      const clip = Clip.pipe(note('C4'), note('E4'), note('G4'))
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = use(clip).apply(bridge)

      expect(result.tick).toBe(1440)
    })

    it('should chain use with other steps', () => {
      const clip = Clip.pipe(note('C4'))
      const bridge = createBridge({ defaultDuration: 480 })
      let b = use(clip).apply(bridge)
      b = note('E4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[1].tick).toBe(480)
    })

    it('should work with empty clip', () => {
      const clip = Clip.pipe()
      const bridge = createBridge({ tick: 100 })
      const result = use(clip).apply(bridge)

      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should return LinkBuilder with weight() and effects()', () => {
      const clip = Clip.pipe(note('C4'))
      const link = use(clip)

      expect(link).toBeDefined()
      expect(typeof link.apply).toBe('function')
      expect(typeof link.weight).toBe('function')
      expect(typeof link.effects).toBe('function')
    })
  })

  describe('use(clip).weight()', () => {
    it('should return LinkBuilder from weight() (chainable)', () => {
      const clip = Clip.pipe(note('C4'))
      const link = use(clip).weight(0.8)

      expect(link).toBeDefined()
      const bridge = createBridge({ defaultDuration: 480 })
      const result = link.apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
    })
  })

  describe('use(clip).effects()', () => {
    it('should apply interceptor effects before clip composition', () => {
      const clip = Clip.pipe(note('C4'), note('E4'))
      const bridge = createBridge({ defaultDuration: 480 })
      const result = use(clip)
        .effects(scoped(sustain()))
        .apply(bridge)
      const { notes, cc: capturedCC } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should compose clip without effects when effects() not called', () => {
      const clip = Clip.pipe(note('C4'))
      const bridge = createBridge({ defaultDuration: 480 })
      const result = use(clip).apply(bridge)
      const { notes, cc } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(cc).toHaveLength(0)
    })
  })
})
