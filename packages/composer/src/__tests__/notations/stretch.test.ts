/**
 * Stretch cue Test — stretch(factor?, ...steps) returns StretchBuilder
 *
 * stretch() time-stretches contained notes by factor: tick and duration
 * are multiplied, making the passage longer (factor > 1) or shorter (factor < 1).
 * Default factor is 1 (no change).
 */

import { describe, it, expect } from 'vitest'
import { stretch } from '../../cues/stretch'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { StretchBuilder } from '../../builders/StretchBuilder'

describe('stretch', () => {

  describe('stretch(factor?, ...steps) returns StretchBuilder', () => {
    it('should return StretchBuilder instance', () => {
      const result = stretch(2, note(6000))
      expect(result).toBeInstanceOf(StretchBuilder)
    })

    it('should return StretchBuilder when called with no args', () => {
      const result = stretch()
      expect(result).toBeInstanceOf(StretchBuilder)
    })

    it('factor 1 (default): notes unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(1, note(6000), note(6400)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 480 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 480, duration: 480 })
    })

    it('factor 2: doubles tick and duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2, note(6000), note(6400)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 960, duration: 960 })
    })

    it('should advance total tick by stretched duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch(2, note(6000), note(6400)).apply(bridge)

      expect(result.tick).toBe(1920) // 2 notes * 480 * 2
    })

    it('factor 0.5: halves tick and duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(0.5, note(6000), note(6400)).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 240 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 240, duration: 240 })
    })

    it('pass through when no steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })

    it('stretch(2) with .steps(): apply factor via builder', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2)
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(960)
      expect(notes[1].tick).toBe(960)
    })

    it('default factor (omit factor): use .steps() for no change', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch()
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0, duration: 480 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 480, duration: 480 })
    })

    it('should allow subsequent steps after stretch', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = stretch(2, note(6000)).apply(bridge)
      b = note(6400).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 6000, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 960, duration: 480 })
    })

    it('chain .factor() to override', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(1)
        .factor(0.5)
        .steps(note(6000), note(6400))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].tick).toBe(240)
    })
  })
})
