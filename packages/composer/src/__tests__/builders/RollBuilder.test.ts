/**
 * RollBuilder Test — drums.roll() returns RollBuilder
 *
 * Tests the RollBuilder used for buzz rolls: rapid repeated hits over a
 * duration. Covers:
 *   - Basic emission and hit count
 *   - Duration and rate configuration
 *   - Tick advance
 *   - Null pitch pass-through
 *   - Builder chaining (.duration(), .rate())
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { roll } from '../../cues/drums'
import { createBridge, commitAndCapture } from '../test-utils'
import { BASS_DRUM_1, ACOUSTIC_SNARE, COWBELL } from '@symphonyscript/theory-legacy'

describe('RollBuilder', () => {

  // ========================================================================
  // Basic emission
  // ========================================================================

  describe('basic emission', () => {
    it('should emit rapid repeated hits over duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1, 480, 120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      notes.forEach(n => {
        expect(n.pitch).toBe(BASS_DRUM_1)
        expect(n.duration).toBe(120)
      })
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(ACOUSTIC_SNARE).apply(bridge)

      const { notes } = commitAndCapture(result)
      // duration=480, rate=defaultDuration/4=120 -> 4 hits
      expect(notes.length).toBeGreaterThanOrEqual(1)
      expect(notes[0].pitch).toBe(ACOUSTIC_SNARE)
    })

    it('should use bridge velocity for emitted notes', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 600 })
      const result = roll(COWBELL, 480, 120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(600)
    })
  })

  // ========================================================================
  // Duration and rate
  // ========================================================================

  describe('duration and rate', () => {
    it('.duration() should override total roll duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1)
        .duration(240)
        .rate(60)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(result.tick).toBe(240)
    })

    it('.rate() should set hit duration and thus hit count', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1, 480, 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].duration).toBe(240)
    })

    it('hitDuration defaults to defaultDuration/4 when rate not provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1, 480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
    })
  })

  // ========================================================================
  // Tick advance
  // ========================================================================

  describe('tick advance', () => {
    it('should advance tick by total duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 480 })
      const result = roll(ACOUSTIC_SNARE, 480, 120).apply(bridge)

      expect(result.tick).toBe(480)
    })

    it('should space hits sequentially', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1, 480, 120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(120)
      expect(notes[2].tick).toBe(240)
      expect(notes[3].tick).toBe(360)
    })
  })

  // ========================================================================
  // Null pitch
  // ========================================================================

  describe('null pitch', () => {
    it('should return bridge unchanged when pitch omitted', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 480 })
      const result = roll().apply(bridge)

      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = roll(BASS_DRUM_1, 480, 120)
      const withDuration = original.duration(240)
      const withRate = original.rate(60)

      const bridge = createBridge({ defaultDuration: 480 })

      const origResult = commitAndCapture(original.apply(bridge))
      const durResult = commitAndCapture(withDuration.apply(bridge))
      const rateResult = commitAndCapture(withRate.apply(bridge))

      expect(origResult.notes).toHaveLength(4)
      expect(origResult.notes[0].duration).toBe(120)

      // .duration(240) overrides total duration only; rate stays 120 -> 2 hits @ 120 each
      expect(durResult.notes).toHaveLength(2)
      expect(durResult.notes[0].duration).toBe(120)

      expect(rateResult.notes).toHaveLength(8)
    })
  })

  // ========================================================================
  // Chaining
  // ========================================================================

  describe('chaining', () => {
    it('should chain .duration() and .rate()', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = roll(BASS_DRUM_1)
        .duration(240)
        .rate(60)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(4)
      expect(notes[0].duration).toBe(60)
    })

    it('should chain with subsequent steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = roll(BASS_DRUM_1, 480, 120).apply(bridge)
      b = roll(ACOUSTIC_SNARE, 240, 120).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(6)
      expect(notes[4].pitch).toBe(ACOUSTIC_SNARE)
    })
  })
})
