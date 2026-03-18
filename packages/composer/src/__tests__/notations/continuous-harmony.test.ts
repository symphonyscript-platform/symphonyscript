/**
 * Tests for RFC-060 Task 7: FrozenClip cents + ratios() utility.
 */

import { describe, it, expect } from 'vitest'
import { BaseCompositionBridge } from '../../composition/BaseCompositionBridge'
import { testNotation } from '../test-utils'
import { RecordingBridge } from '../../composition/RecordingBridge'
import { ratios } from '../../cues/ratios'
import { note } from '../../cues/note'

describe('RFC-060 Task 7: Harmony + FrozenClip', () => {
  describe('ratios()', () => {
    it('converts frequency ratios to cent intervals and emits notes', () => {
      // Just major triad: 1, 5/4, 3/2
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = ratios([1, 5/4, 3/2]).apply(b) as BaseCompositionBridge
      // Should have advanced tick by one duration
      expect(result.tick).toBe(480)
    })

    it('ratios with custom root', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = ratios([1, 5/4, 3/2], 5700).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('ratios with explicit duration', () => {
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = ratios([1, 3/2], 4800, 240).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(240)
    })

    it('single ratio [1] emits one note at root', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = ratios([1]).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('velocity() modifier works', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = ratios([1]).velocity(500).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('repeat() modifier works', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = ratios([1]).repeat(2).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(960) // 2 × 480
    })
  })

  describe('FrozenClip captures cents', () => {
    it('captures note pitches in cents through recording pipeline', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = note(6900).apply(b) as BaseCompositionBridge

      // Commit to recorder
      const recorder = new RecordingBridge()
      result.commit(recorder)

      const frozen = recorder.toFrozenClip()
      expect(frozen.noteCount).toBe(1)

      let capturedPitch = 0
      frozen.visitNotes((_src, pitch) => {
        capturedPitch = pitch
      })

      // A4 in test notation: (4+1)*1200 + 900 = 6900
      expect(capturedPitch).toBe(6900)
    })

    it('captures multiple cent pitches correctly', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      // C4 then E4
      const result = note(6000).apply(
        note(6400).apply(b) as BaseCompositionBridge,
      ) as BaseCompositionBridge

      const recorder = new RecordingBridge()
      result.commit(recorder)

      const frozen = recorder.toFrozenClip()
      expect(frozen.noteCount).toBe(2)

      const pitches: number[] = []
      frozen.visitNotes((_src, pitch) => {
        pitches.push(pitch)
      })

      // Test notation: C4 = 6000, E4 = 6400
      expect(pitches).toContain(6000)
      expect(pitches).toContain(6400)
    })
  })
})
