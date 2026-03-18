/**
 * StepsBuilder Test — melody.steps(pattern, notes, stepDuration)
 *
 * Binary step pattern: 1 = play note (cycling through notes), 0 = rest.
 */

import { describe, it, expect } from 'vitest'
import { steps } from '../../cues/melody'
import { StepsBuilder } from '../../builders/StepsBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

describe('StepsBuilder', () => {

  describe('return type', () => {
    it('steps() should return StepsBuilder', () => {
      const result = steps()
      expect(result).toBeInstanceOf(StepsBuilder)
    })

    it('steps([1,0,1], ["C4","E4"]) should return StepsBuilder', () => {
      const result = steps([1, 0, 1], ['C4', 'E4'])
      expect(result).toBeInstanceOf(StepsBuilder)
    })
  })

  describe('binary pattern emission', () => {
    it('pattern [1,0,1] with notes [C4,E4] should emit C4 then E4 on hits, rest on 0', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([1, 0, 1], ['C4', 'E4']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(240)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[1].tick).toBe(480)  // after step 0 (rest) and step 1
      expect(notes[1].duration).toBe(240)
    })

    it('pattern [1,1,1] with notes [C4,E4] should cycle C4, E4, C4', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([1, 1, 1], ['C4', 'E4']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0]).toMatchObject({ pitch: 6000, tick: 0 })
      expect(notes[1]).toMatchObject({ pitch: 6400, tick: 240 })
      expect(notes[2]).toMatchObject({ pitch: 6000, tick: 480 })
    })

    it('pattern [1,1] with single note should repeat same pitch', () => {
      const bridge = createBridge({ defaultDuration: 120 })
      const result = steps([1, 1], ['G4']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6700)
      expect(notes[1].pitch).toBe(6700)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(120)
    })

    it('should advance tick for full pattern length', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 240 })
      const result = steps([1, 0, 1, 0], ['C4', 'E4']).apply(bridge)
      expect(result.tick).toBe(960)  // 4 steps x 240
    })

    it('pattern [0,0] should emit no notes but advance tick', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([0, 0], ['C4']).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(result.tick).toBe(480)
    })
  })

  describe('stepDuration', () => {
    it('should use explicit stepDuration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = steps([1, 1], ['C4'], 120).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
      expect(notes[1].duration).toBe(120)
    })

    it('should use bridge defaultDuration when stepDuration not provided', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([1, 1], ['C4']).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
    })
  })

  describe('no-op when empty', () => {
    it('steps([], [...]) should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 100, defaultDuration: 240 })
      const result = steps([], ['C4']).apply(bridge)
      expect(result.tick).toBe(100)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('steps([1,1], []) should return bridge unchanged', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 240 })
      const result = steps([1, 1], []).apply(bridge)
      expect(result.tick).toBe(0)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('builder chaining', () => {
    it('.pattern() should override pattern', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([1], ['C4'])
        .pattern([1, 1])
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
    })

    it('.notes() should override notes', () => {
      const bridge = createBridge({ defaultDuration: 240 })
      const result = steps([1, 1], ['C4'])
        .notes(['E4', 'G4'])
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(6400)
      expect(notes[1].pitch).toBe(6700)
    })

    it('.stepDuration() should override step duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = steps([1, 1], ['C4'])
        .stepDuration(60)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(60)
    })
  })

  describe('immutability', () => {
    it('.pattern(), .notes(), .stepDuration() should return new instances', () => {
      const base = steps([1], ['C4'])
      const withPattern = base.pattern([1, 1])
      const withNotes = base.notes(['E4'])
      const withStepDur = base.stepDuration(60)

      expect(withPattern).not.toBe(base)
      expect(withNotes).not.toBe(base)
      expect(withStepDur).not.toBe(base)

      const bridge = createBridge({ defaultDuration: 240 })
      const baseNotes = commitAndCapture(base.apply(bridge)).notes
      const patternNotes = commitAndCapture(withPattern.apply(bridge)).notes
      expect(baseNotes).toHaveLength(1)
      expect(patternNotes).toHaveLength(2)
    })
  })
})
