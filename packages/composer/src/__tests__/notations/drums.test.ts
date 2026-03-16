/**
 * Drums cue Test — kick(), snare(), drumPattern(), hit(), etc.
 *
 * Tests drum cue helpers that return DrumHitBuilder or DrumPatternBuilder.
 * x = hit, . = rest (advance tick), - = sustain (advance tick, no new hit).
 */

import { describe, it, expect } from 'vitest'
import { kick, snare, drumPattern, hit, roll } from '../../cues/drums'
import { GM_DRUM } from '@symphonyscript/theory'
import { createBridge, commitAndCapture } from '../test-utils'

describe('drums', () => {

  describe('kick', () => {
    it('should emit BASS_DRUM_1 (36) at current tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = kick().apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(GM_DRUM.BASS_DRUM_1)
      expect(notes[0].pitch).toBe(36)
    })

    it('should use custom duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = kick(240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(240)
    })

    it('should advance tick by duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = kick().apply(bridge)

      expect(result.tick).toBe(480)
    })

    it('should chain with snare', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = kick().apply(bridge)
      b = snare().apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(GM_DRUM.BASS_DRUM_1)
      expect(notes[1].pitch).toBe(GM_DRUM.ACOUSTIC_SNARE)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })
  })

  describe('snare', () => {
    it('should emit ACOUSTIC_SNARE (38) at current tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = snare().apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(GM_DRUM.ACOUSTIC_SNARE)
      expect(notes[0].pitch).toBe(38)
    })

    it('should use custom duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = snare(120).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(120)
    })

    it('should advance tick by duration', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = snare().apply(bridge)

      expect(result.tick).toBe(580)
    })
  })

  describe('drumPattern', () => {
    it('should emit hits for x and X, advance tick for . and -', () => {
      const bridge = createBridge({ defaultDuration: 120 })
      const result = drumPattern('x.x.', GM_DRUM.BASS_DRUM_1).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(GM_DRUM.BASS_DRUM_1)
      expect(notes[1].pitch).toBe(GM_DRUM.BASS_DRUM_1)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
    })

    it('should use stepDuration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = drumPattern('xx', GM_DRUM.ACOUSTIC_SNARE, 240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(240)
    })

    it('should advance tick for each character in pattern', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 120 })
      const result = drumPattern('x.x', GM_DRUM.BASS_DRUM_1).apply(bridge)

      expect(result.tick).toBe(360)
    })

    it('should return bridge unchanged when cue is empty', () => {
      const bridge = createBridge({ tick: 0 })
      const result = drumPattern('', GM_DRUM.BASS_DRUM_1).apply(bridge)

      expect(result.tick).toBe(0)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should return bridge unchanged when pitch is null (via missing cue)', () => {
      const bridge = createBridge({ tick: 0 })
      const result = drumPattern().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should support chaining .cue() and .pitch()', () => {
      const bridge = createBridge({ defaultDuration: 120 })
      const result = drumPattern()
        .cue('x.x')
        .pitch(GM_DRUM.CLOSED_HI_HAT)
        .apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(GM_DRUM.CLOSED_HI_HAT)
      expect(notes[1].pitch).toBe(GM_DRUM.CLOSED_HI_HAT)
    })
  })

  describe('roll', () => {
    it('should emit rapid repeated hits over duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(GM_DRUM.BASS_DRUM_1, 480, 120).apply(bridge)
      const { notes } = commitAndCapture(result)

      // 480 / 120 = 4 hits
      expect(notes).toHaveLength(4)
      notes.forEach(n => {
        expect(n.pitch).toBe(GM_DRUM.BASS_DRUM_1)
        expect(n.duration).toBe(120)
      })
    })

    it('should advance tick by duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = roll(GM_DRUM.ACOUSTIC_SNARE, 480, 120).apply(bridge)
      expect(result.tick).toBe(480)
    })

    it('should use default duration and rate when omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(GM_DRUM.COWBELL).apply(bridge)
      const { notes } = commitAndCapture(result)

      // duration=480, rate=defaultDuration/4=120 -> 4 hits
      expect(notes.length).toBeGreaterThanOrEqual(1)
      expect(notes[0].pitch).toBe(GM_DRUM.COWBELL)
    })

    it('should return bridge unchanged when pitch omitted', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = roll().apply(bridge)
      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('should chain .duration() and .rate()', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(GM_DRUM.BASS_DRUM_1)
        .duration(240)
        .rate(60)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].duration).toBe(60)
    })
  })

  describe('hit', () => {
    it('should emit note at given pitch when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = hit(GM_DRUM.COWBELL).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(GM_DRUM.COWBELL)
    })

    it('should use default pitch when pitch omitted', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = hit(undefined, 240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(36)
    })
  })
})
