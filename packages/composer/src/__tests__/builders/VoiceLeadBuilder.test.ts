/**
 * VoiceLeadBuilder Test
 *
 * Tests voiceLead() — voice-led chord progression from roman numerals:
 *   - voiceLead(['I', 'IV', 'V', 'I'])
 *   - Minimizes voice movement between chords
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { voiceLead } from '../../notations/voiceLead'
import { VoiceLeadBuilder } from '../../builders/VoiceLeadBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { note } from '../../notations/note'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('VoiceLeadBuilder', () => {

  describe('voiceLead chord progression', () => {
    it('voiceLead(["I", "IV", "V", "I"]) should emit chord progression', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
        velocity: 100,
      })
      const result = voiceLead(['I', 'IV', 'V', 'I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      // I (3) + IV (3) + V (3) + I (3) = 12 notes
      expect(notes).toHaveLength(12)
      // I: C4=60, E4=64, G4=67
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      // IV: F, A, C — voice leading should choose close voicings
      expect(notes[3].pitch).toBe(65) // F4
      expect(notes[4].pitch).toBe(69) // A4
      expect(notes[5].pitch).toBe(72) // C5
      // V: G, B, D
      expect(notes[6].pitch).toBe(67)
      expect(notes[7].pitch).toBe(71)
      expect(notes[8].pitch).toBe(74)
      // I: C, E, G — final I voiced for minimal movement from V (G4,B4,D5)
      expect(notes[9].pitch).toBe(72)   // C5
      expect(notes[10].pitch).toBe(76) // E5 (voice lead from D5)
      expect(notes[11].pitch).toBe(79) // G5 (voice lead from D5)
    })

    it('voiceLead(["I", "vi", "IV", "V"]) should emit I-vi-IV-V', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I', 'vi', 'IV', 'V']).apply(bridge)

      const { notes } = commitAndCapture(result)
      // 4 * 3 = 12 notes
      expect(notes).toHaveLength(12)
      // I = CEG
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      // vi = Am = A, C, E — may be voiced in lower octave
      expect(notes[3].pitch).toBe(57)
    })

    it('voiceLead with single chord should emit one chord', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
    })
  })

  describe('voice leading (minimal movement)', () => {
    it('second chord should use close voicing to first chord', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I', 'IV']).apply(bridge)

      const { notes } = commitAndCapture(result)
      // I: C4(60), E4(64), G4(67)
      // IV: F, A, C — voiceLead picks octave placements to minimize movement
      expect(notes).toHaveLength(6)
      // First chord at tick 0; second chord follows after first chord duration (480)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
      expect(notes[2].tick).toBe(0)
      expect(notes[3].tick).toBe(480)
      expect(notes[4].tick).toBe(480)
      expect(notes[5].tick).toBe(480)
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I', 'V'], 240).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
      expect(notes[3].duration).toBe(240)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 360,
      })
      const result = voiceLead(['I']).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(360)
    })
  })

  describe('modifiers', () => {
    it('.numerals() should replace progression', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I'])
        .numerals(['I', 'V'])
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(6)
    })

    it('.duration() should override initial duration', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const result = voiceLead(['I', 'V'], 480).duration(120).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = voiceLead(['I', 'IV'])
      const withDur = original.duration(240)
      const withNumerals = original.numerals(['I', 'V'])

      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      const origResult = commitAndCapture(original.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))
      const numeralsResult = commitAndCapture(withNumerals.apply(bridge))

      expect(origResult.notes[0].duration).toBe(480)
      expect(durResult.notes[0].duration).toBe(240)
      expect(numeralsResult.notes).toHaveLength(6)
    })
  })

  describe('chaining with note', () => {
    it('voiceLead then note should advance tick and emit both', () => {
      const bridge = createBridge({
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
        defaultDuration: 480,
      })
      let b: CompositionBridge = bridge
      b = voiceLead(['I', 'V']).apply(b)
      b = note('C5').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(7) // 3 + 3 + 1
      expect(notes[6].pitch).toBe(72)
      expect(notes[6].tick).toBe(960)
    })
  })
})
