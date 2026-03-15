/**
 * voiceLead Notation Test — voiceLead(numerals, duration) VoiceLeadBuilder
 *
 * Voice-led chord progression from roman numerals with minimal voice movement.
 */

import { describe, it, expect } from 'vitest'
import { voiceLead } from '../../notations/voiceLead'
import { VoiceLeadBuilder } from '../../builders/VoiceLeadBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

describe('voiceLead', () => {

  describe('return type', () => {
    it('voiceLead(["I"]) should return VoiceLeadBuilder', () => {
      const result = voiceLead(['I'])
      expect(result).toBeInstanceOf(VoiceLeadBuilder)
    })

    it('voiceLead(["I","IV","V","I"], 240) should return VoiceLeadBuilder', () => {
      const result = voiceLead(['I', 'IV', 'V', 'I'], 240)
      expect(result).toBeInstanceOf(VoiceLeadBuilder)
    })
  })

  describe('chord progression emission', () => {
    it('voiceLead(["I"]) should emit I chord (C, E, G in C major)', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)  // C4
      expect(notes[1].pitch).toBe(64)  // E4
      expect(notes[2].pitch).toBe(67)  // G4
    })

    it('voiceLead(["I","IV"]) should emit I then IV chords', () => {
      const bridge = createBridge({
        defaultDuration: 240,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I', 'IV']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(6)
      // I chord: C, E, G
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)
      // IV chord: F, A, C (voice-led, so likely closest octave to previous)
      expect(notes[3].pitch).toBe(65)  // F4
      expect(notes[4].pitch).toBe(69)   // A4
      expect(notes[5].pitch).toBe(72)   // C5
    })

    it('voiceLead(["I","V","I"]) should emit I-V-I progression', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I', 'V', 'I']).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(9)  // 3 chords x 3 notes each
      // All pitches should be valid chord tones
      const chord1 = notes.slice(0, 3).map(n => n.pitch)
      const chord2 = notes.slice(3, 6).map(n => n.pitch)
      const chord3 = notes.slice(6, 9).map(n => n.pitch)
      expect(chord1).toContain(60)  // C
      expect(chord1).toContain(64)  // E
      expect(chord1).toContain(67)  // G
      // V chord (G, B, D) voice-led from I: G3, B3, D4 minimize movement from C4, E4, G4
      expect(chord2).toContain(55)  // G (V root)
      expect(chord2).toContain(59)  // B
      expect(chord2).toContain(62)  // D
      expect(chord3).toEqual(expect.arrayContaining([60, 64, 67]))
    })

    it('should advance tick by total duration', () => {
      const bridge = createBridge({ tick: 0, defaultDuration: 240 })
      const result = voiceLead(['I', 'IV']).apply(bridge)
      expect(result.tick).toBe(480)  // 2 chords x 240
    })
  })

  describe('duration', () => {
    it('should use explicit duration when provided', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I'], 120).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(120)
    })

    it('should use bridge defaultDuration when duration not provided', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I']).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('empty / no-op', () => {
    it('voiceLead([]) should emit no notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = voiceLead([]).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('builder chaining', () => {
    it('.numerals() should override numerals', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I'])
        .numerals(['V'])
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(67)  // G
      expect(notes[1].pitch).toBe(71)  // B
      expect(notes[2].pitch).toBe(74)  // D
    })

    it('.duration() should override duration', () => {
      const bridge = createBridge({
        defaultDuration: 480,
        scaleRoot: PitchClass.C,
        scaleMode: ScaleMode.MAJOR,
      })
      const result = voiceLead(['I'])
        .duration(240)
        .apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes[0].duration).toBe(240)
    })
  })
})
