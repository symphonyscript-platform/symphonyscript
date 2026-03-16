/**
 * StretchBuilder Test — stretch() returns StretchBuilder
 *
 * Tests the StretchBuilder that time-stretches contained notes by factor:
 * tick and duration are multiplied. Covers:
 *   - Basic stretch (factor 1, 2, 0.5)
 *   - .steps() and .factor() builder methods
 *   - Empty steps pass-through
 *   - Tick advance
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { stretch } from '../../cues/stretch'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { StretchBuilder } from '../../builders/StretchBuilder'

describe('StretchBuilder', () => {

  // ========================================================================
  // Basic stretch
  // ========================================================================

  describe('basic stretch', () => {
    it('factor 1 (default): notes unchanged', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(1, note('C4'), note('E4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0, duration: 480 })
      expect(notes[1]).toMatchObject({ pitch: 64, tick: 480, duration: 480 })
    })

    it('factor 2: doubles tick and duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2, note('C4'), note('E4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 64, tick: 960, duration: 960 })
    })

    it('factor 0.5: halves tick and duration', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(0.5, note('C4'), note('E4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 60, tick: 0, duration: 240 })
      expect(notes[1]).toMatchObject({ pitch: 64, tick: 240, duration: 240 })
    })
  })

  // ========================================================================
  // Builder methods
  // ========================================================================

  describe('builder methods', () => {
    it('.steps() should add steps when using stretch(2) without initial steps', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(2)
        .steps(note('C4'), note('E4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(960)
      expect(notes[1].tick).toBe(960)
    })

    it('.factor() should override initial factor', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = stretch(1)
        .factor(0.5)
        .steps(note('C4'), note('E4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].tick).toBe(240)
    })
  })

  // ========================================================================
  // Empty steps
  // ========================================================================

  describe('empty steps', () => {
    it('should pass through when no steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })
  })

  // ========================================================================
  // Tick advance
  // ========================================================================

  describe('tick advance', () => {
    it('should advance total tick by stretched duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch(2, note('C4'), note('E4')).apply(bridge)

      expect(result.tick).toBe(1920)
    })

    it('should allow subsequent steps after stretch', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = stretch(2, note('C4')).apply(bridge)
      b = note('E4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0]).toMatchObject({ pitch: 60, duration: 960 })
      expect(notes[1]).toMatchObject({ pitch: 64, tick: 960, duration: 480 })
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = stretch(2, note('C4'))
      const withFactor = original.factor(0.5)
      const withSteps = original.steps(note('E4'))

      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })

      const origResult = commitAndCapture(original.apply(bridge))
      const factorResult = commitAndCapture(withFactor.apply(bridge))
      const stepsResult = commitAndCapture(withSteps.apply(bridge))

      expect(origResult.notes[0].duration).toBe(960)
      expect(factorResult.notes[0].duration).toBe(240)
      expect(stepsResult.notes).toHaveLength(2)
    })
  })

  // ========================================================================
  // Return type
  // ========================================================================

  describe('return type', () => {
    it('should return StretchBuilder instance', () => {
      const result = stretch(2, note('C4'))
      expect(result).toBeInstanceOf(StretchBuilder)
    })

    it('stretch() with no args should return StretchBuilder', () => {
      const result = stretch()
      expect(result).toBeInstanceOf(StretchBuilder)
    })
  })
})
