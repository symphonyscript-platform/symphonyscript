/**
 * Reverse cue Test — reverse(...steps) returns ReverseBuilder
 *
 * reverse() reverses the temporal order of contained notes: the last note
 * becomes first, the first becomes last, etc.
 */

import { describe, it, expect } from 'vitest'
import { reverse } from '../../cues/reverse'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { ReverseBuilder } from '../../builders/ReverseBuilder'

describe('reverse', () => {

  describe('reverse(...steps) returns ReverseBuilder', () => {
    it('should return ReverseBuilder instance', () => {
      const result = reverse(note('C4'), note('E4'))
      expect(result).toBeInstanceOf(ReverseBuilder)
    })

    it('should return ReverseBuilder when called with no args', () => {
      const result = reverse()
      expect(result).toBeInstanceOf(ReverseBuilder)
    })

    it('single note: unchanged order', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = reverse(note('C4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0 })
    })

    it('should reverse order of multiple notes', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = reverse(note('C4'), note('E4'), note('G4')).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      // Original: C4@0, E4@480, G4@960. Reversed: G4@0, E4@480, C4@960
      expect(notes[0]).toMatchObject({ pitch: 6700, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 480 })
      expect(notes[2]).toMatchObject({ pitch: 6000, tick: 960 })
    })

    it('should preserve total duration after reverse', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = reverse(note('C4'), note('E4'), note('G4')).apply(bridge)

      expect(result.tick).toBe(1440) // 3 * 480
    })

    it('should pass through bridge when no steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = reverse().apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(bridge.tick)
    })

    it('should allow subsequent steps after reverse', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = reverse(note('C4'), note('E4')).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      // Reversed: E4@0, C4@480; then G4@960
      expect(notes[0].pitch).toBe(6400)
      expect(notes[1].pitch).toBe(6000)
      expect(notes[2].pitch).toBe(6700)
    })

    it('should chain .steps() fluently', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = reverse()
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6700)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6000)
    })
  })
})
