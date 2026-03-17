/**
 * DegreeBuilder Test
 *
 * Tests degree() scale-degree resolution:
 *   - degree(1), degree(5) in C major
 *   - Scale context (scaleRoot, scaleMode)
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { degree } from '../../cues/degree'
import { DegreeBuilder } from '../../builders/DegreeBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/notations'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('DegreeBuilder', () => {

  describe('basic degree resolution', () => {
    it('degree(1) should emit root (C4) in C major', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1).apply(bridge)

      expect(result.tick).toBe(480)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(480)
    })

    it('degree(5) should emit fifth (G4) in C major', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(5).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(67) // G4
    })

    it('degree(3) should emit third (E4) in C major', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(degree(3).apply(bridge))

      expect(notes[0].pitch).toBe(64) // E4
    })
  })

  describe('scale context', () => {
    it('degree(1) in G major should resolve to G4 (pitch 67)', () => {
      const bridge = createBridge({
        scaleRoot: 7 as PitchClass, // G
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const { notes } = commitAndCapture(degree(1).apply(bridge))

      expect(notes[0].pitch).toBe(67) // G4
    })

    it('degree(1) in A minor should resolve to A4 (pitch 69)', () => {
      const bridge = createBridge({
        scaleRoot: 9 as PitchClass, // A
        scaleMode: ScaleMode.MINOR,
        defaultDuration: 480,
      })
      const { notes } = commitAndCapture(degree(1).apply(bridge))

      expect(notes[0].pitch).toBe(69) // A4
    })

    it('degree(3) in A minor should resolve to C5 (minor third)', () => {
      const bridge = createBridge({
        scaleRoot: 9 as PitchClass,
        scaleMode: ScaleMode.MINOR,
      })
      const { notes } = commitAndCapture(degree(3).apply(bridge))

      expect(notes[0].pitch).toBe(72) // C5
    })

    it('degree(1) with default bridge (C major) should be C4', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(degree(1).apply(bridge))
      expect(notes[0].pitch).toBe(60)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1, 240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
      expect(result.tick).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(480)
    })
  })

  describe('inherited modifiers', () => {
    it('.velocity() should override bridge velocity', () => {
      const bridge = createBridge({ velocity: 600 })
      const { notes } = commitAndCapture(degree(1).velocity(1000).apply(bridge))
      expect(notes[0].velocity).toBe(1000)
    })

    it('.up() should shift octave', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(degree(1).up().apply(bridge))
      expect(notes[0].pitch).toBe(72) // C5
    })

    it('.repeat(2) should emit degree twice', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = degree(1).repeat(2).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(60)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = degree(1)
      const withVel = original.velocity(1000)
      const withDur = original.duration(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.apply(bridge))
      const velResult = commitAndCapture(withVel.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))

      expect(origResult.notes[0].velocity).toBe(800)
      expect(velResult.notes[0].velocity).toBe(1000)
      expect(durResult.notes[0].duration).toBe(240)
      expect(origResult.notes[0].duration).toBe(480)
    })
  })

  describe('chaining with note', () => {
    it('degree then note should both emit and advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = degree(1).apply(b)
      b = degree(5).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[1].pitch).toBe(67) // G4
      expect(notes[1].tick).toBe(480)
    })
  })
})
