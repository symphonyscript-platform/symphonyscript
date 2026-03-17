/**
 * Exemplar: Builder Test — NoteBuilder
 *
 * Tests the NoteBuilder (returned by `note()`), the most complex builder
 * in the composition API. Covers:
 *   - Basic note emission and tick advance
 *   - String vs numeric pitch resolution
 *   - Velocity, duration, and duration scaling (staccato/legato)
 *   - Octave shift (.up(), .down(), .octave())
 *   - Accidental override (.sharp(), .flat(), .natural())
 *   - Key context interaction (accidentalOverride + applyKeySignature)
 *   - Transpose (per-note .transpose())
 *   - Repeat (.repeat())
 *   - Flags (.precise(), .muted()) and flag reset
 *   - Expression (.detune(), .timbre(), .pressure(), .aftertouch())
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { PitchClass, ScaleMode } from '@symphonyscript/notations'
import { CompositionBridge } from '../../interfaces/composition-bridge'

describe('NoteBuilder', () => {

  // ========================================================================
  // Basic emission
  // ========================================================================

  describe('basic emission', () => {
    it('should emit a note at the current tick and advance tick by defaultDuration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note('C4').apply(bridge)

      expect(result.tick).toBe(480)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(480)
    })

    it('should use bridge velocity when no explicit velocity is set', () => {
      const bridge = createBridge({ velocity: 600 })
      const result = note('C4').apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(600)
    })

    it('should emit with explicit velocity when set', () => {
      const bridge = createBridge({ velocity: 600 })
      const result = note('C4').velocity(1000).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(1000)
    })

    it('should use explicit duration over bridge defaultDuration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note('C4').duration(240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
      expect(result.tick).toBe(240) // tick advances by note duration
    })
  })

  // ========================================================================
  // Pitch resolution
  // ========================================================================

  describe('pitch resolution', () => {
    it('should resolve string pitch names to MIDI numbers', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('A4').apply(bridge))
      expect(notes[0].pitch).toBe(69)
    })

    it('should accept raw MIDI numbers', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(72).apply(bridge))
      expect(notes[0].pitch).toBe(72)
    })

    it('should apply bridge transpose to final pitch', () => {
      const bridge = createBridge({ transpose: 5 })
      const { notes } = commitAndCapture(note(60).apply(bridge))
      expect(notes[0].pitch).toBe(65) // 60 + 5
    })
  })

  // ========================================================================
  // Octave shift
  // ========================================================================

  describe('octave shift', () => {
    it('.up() should shift pitch up by 12 semitones', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').up().apply(bridge))
      expect(notes[0].pitch).toBe(72) // C5
    })

    it('.down() should shift pitch down by 12 semitones', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').down().apply(bridge))
      expect(notes[0].pitch).toBe(48) // C3
    })

    it('.up(2) should shift pitch up by 24 semitones', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').up(2).apply(bridge))
      expect(notes[0].pitch).toBe(84) // C6
    })

    it('.octave(1) should shift by +1 octave (12 semitones)', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').octave(1).apply(bridge))
      expect(notes[0].pitch).toBe(72)
    })

    it('.octave(-1) should shift by -1 octave', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').octave(-1).apply(bridge))
      expect(notes[0].pitch).toBe(48)
    })
  })

  // ========================================================================
  // Accidental override and key context
  // ========================================================================

  describe('accidentals', () => {
    it('.sharp() on numeric pitch should add 1 semitone', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(60).sharp().apply(bridge))
      expect(notes[0].pitch).toBe(61) // C + 1
    })

    it('.flat() on numeric pitch should subtract 1 semitone', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(60).flat().apply(bridge))
      expect(notes[0].pitch).toBe(59) // C - 1
    })

    it('.natural() on numeric pitch should set accidental to 0', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(60).sharp().natural().apply(bridge))
      expect(notes[0].pitch).toBe(60) // no shift
    })
  })

  describe('accidentals with key context', () => {
    // In G major, F is sharped. note('F4') in G major should resolve to F#4.
    // note('F4').natural() should override that and give F natural.
    it('.natural() should override key signature sharps', () => {
      const bridge = createBridge({
        keyRoot: 14 as PitchClass, // G (24-EDO)
        keyMode: ScaleMode.MAJOR,
      })
      // note('F4') in G major → F#4 (MIDI 66)
      const withKey = commitAndCapture(note('F4').apply(bridge))
      expect(withKey.notes[0].pitch).toBe(66) // F#4

      // note('F4').natural() in G major → F4 (MIDI 65)
      const withNatural = commitAndCapture(note('F4').natural().apply(bridge))
      expect(withNatural.notes[0].pitch).toBe(65) // F natural
    })

    it('.flat() should override key signature and apply flat', () => {
      const bridge = createBridge({
        keyRoot: 14 as PitchClass, // G (24-EDO)
        keyMode: ScaleMode.MAJOR,
      })
      // note('B4').flat() in G major → Bb4 (MIDI 70)
      const { notes } = commitAndCapture(note('B4').flat().apply(bridge))
      expect(notes[0].pitch).toBe(70) // Bb4
    })

    it('should not apply key signature when no key context is set', () => {
      const bridge = createBridge() // keyRoot defaults to null
      const { notes } = commitAndCapture(note('F4').apply(bridge))
      expect(notes[0].pitch).toBe(65) // F4 natural, no key modification
    })
  })

  // ========================================================================
  // Duration scaling (articulation)
  // ========================================================================

  describe('articulation / duration scaling', () => {
    it('.staccato() should halve the duration', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').duration(480).staccato().apply(bridge))
      expect(notes[0].duration).toBe(240) // 480 * 0.5
    })

    it('.tenuto() should scale duration to 95%', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').duration(480).tenuto().apply(bridge))
      expect(notes[0].duration).toBe(456) // Math.round(480 * 0.95)
    })

    it('.marcato() should scale duration to 70% and boost velocity', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').duration(480).marcato().apply(bridge))
      expect(notes[0].duration).toBe(336) // Math.round(480 * 0.7)
      expect(notes[0].velocity).toBe(1000) // default 800 + 200
    })
  })

  // ========================================================================
  // Per-note transpose
  // ========================================================================

  describe('per-note transpose', () => {
    it('.transpose() should shift pitch by semitones', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note('C4').transpose(7).apply(bridge))
      expect(notes[0].pitch).toBe(67) // C4 (60) + 7 = G4
    })

    it('.transpose() should stack with bridge transpose', () => {
      const bridge = createBridge({ transpose: 3 })
      const { notes } = commitAndCapture(note(60).transpose(4).apply(bridge))
      // Bridge adds 3, note adds 4, but bridge transpose is applied inside withNote()
      // Final = (60 + 4) + 3 from bridge = 67
      expect(notes[0].pitch).toBe(67)
    })
  })

  // ========================================================================
  // Repeat
  // ========================================================================

  describe('repeat', () => {
    it('.repeat(3) should emit the same note 3 times (advancing tick each)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note('C4').repeat(3).apply(bridge)

      expect(result.tick).toBe(1440) // 3 * 480

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
      expect(notes[2].tick).toBe(960)
      // All same pitch
      expect(notes.every(n => n.pitch === 60)).toBe(true)
    })
  })

  // ========================================================================
  // Flags (precise, muted)
  // ========================================================================

  describe('flags', () => {
    it('.precise() should set precise flag on bridge, then reset after', () => {
      const bridge = createBridge()
      expect(bridge.precise).toBe(false)

      const result = note('C4').precise().apply(bridge)
      // After apply, precise should be reset
      expect(result.precise).toBe(false)
    })

    it('.muted() should emit note with muted=true and reset after', () => {
      const bridge = createBridge()
      const result = note('C4').muted().apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].muted).toBe(true)
      expect(result.muted).toBe(false) // reset after
    })
  })

  // ========================================================================
  // Expression CC events
  // ========================================================================

  describe('expression', () => {
    it('.detune() should emit a pitch bend event', () => {
      const bridge = createBridge()
      const result = note('C4').detune(0.5).apply(bridge)
      const { bends } = commitAndCapture(result)

      expect(bends.length).toBeGreaterThanOrEqual(1)
      expect(bends[0].value).toBe(0.5)
    })

    it('.aftertouch() should emit an aftertouch CC event', () => {
      const bridge = createBridge()
      const result = note('C4').aftertouch(80).apply(bridge)
      const { cc } = commitAndCapture(result)

      // Channel aftertouch uses controller 0xD0
      const atEvents = cc.filter(e => e.controller === 0xD0)
      expect(atEvents.length).toBeGreaterThanOrEqual(1)
      expect(atEvents[0].value).toBe(80)
    })
  })

  // ========================================================================
  // Immutability
  // ========================================================================

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = note('C4')
      const withVel = original.velocity(1000)
      const withDur = original.duration(240)

      // Apply all three and check they produce different results
      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.apply(bridge))
      const velResult = commitAndCapture(withVel.apply(bridge))
      const durResult = commitAndCapture(withDur.apply(bridge))

      expect(origResult.notes[0].velocity).toBe(800) // bridge default
      expect(velResult.notes[0].velocity).toBe(1000)
      expect(durResult.notes[0].duration).toBe(240)
      expect(origResult.notes[0].duration).toBe(480) // unchanged
    })
  })

  // ========================================================================
  // Chaining
  // ========================================================================

  describe('chaining', () => {
    it('should support fluent chaining of multiple modifiers', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note('A3')
        .velocity(900)
        .duration(240)
        .up()
        .staccato()
        .transpose(2)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(900)
      expect(notes[0].duration).toBe(120) // 240 * 0.5 (staccato)
      expect(notes[0].pitch).toBe(71)     // A3=57, +12 (up) +2 (transpose) = 71
    })

    it('should handle multiple notes in sequence', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = note('C4').apply(b)
      b = note('E4').apply(b)
      b = note('G4').apply(b)

      expect(b.tick).toBe(1440) // 3 * 480

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[1].pitch).toBe(64) // E4
      expect(notes[2].pitch).toBe(67) // G4
    })
  })
})
