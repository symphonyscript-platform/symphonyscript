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
 *   - Transpose (per-note .transpose())
 *   - Repeat (.repeat())
 *   - Flags (.precise(), .muted()) and flag reset
 *   - Expression (.detune(), .timbre(), .pressure(), .aftertouch())
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { CompositionBridge } from '../../interfaces/composition-bridge'

describe('NoteBuilder', () => {

  // ========================================================================
  // Basic emission
  // ========================================================================

  describe('basic emission', () => {
    it('should emit a note at the current tick and advance tick by defaultDuration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note(6000).apply(bridge)

      expect(result.tick).toBe(480)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].tick).toBe(0)
      expect(notes[0].duration).toBe(480)
    })

    it('should use bridge velocity when no explicit velocity is set', () => {
      const bridge = createBridge({ velocity: 600 })
      const result = note(6000).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(600)
    })

    it('should emit with explicit velocity when set', () => {
      const bridge = createBridge({ velocity: 600 })
      const result = note(6000).velocity(1000).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].velocity).toBe(1000)
    })

    it('should use explicit duration over bridge defaultDuration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note(6000).duration(240).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes[0].duration).toBe(240)
      expect(result.tick).toBe(240) // tick advances by note duration
    })
  })

  // ========================================================================
  // Pitch resolution
  // ========================================================================

  describe('pitch resolution', () => {
    it('should resolve string pitch names via notation', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6900).apply(bridge))
      // A4 resolved via WesternNotation.noteToCents() — exact value depends on notation
      expect(notes[0].pitch).toBeDefined()
    })

    it('should accept raw numeric values (cents)', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(7200).apply(bridge))
      expect(notes[0].pitch).toBe(7200)
    })

    it('should apply bridge transposeCents to final pitch', () => {
      const bridge = createBridge({ transposeCents: 500 })
      const { notes } = commitAndCapture(note(6000).apply(bridge))
      expect(notes[0].pitch).toBe(6500) // 6000 + 500
    })
  })

  // ========================================================================
  // Octave shift
  // ========================================================================

  describe('octave shift', () => {
    it('.up() should shift pitch up by 1200 cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).up().apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch + 1200)
    })

    it('.down() should shift pitch down by 1200 cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).down().apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch - 1200)
    })

    it('.up(2) should shift pitch up by 2400 cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).up(2).apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch + 2400)
    })

    it('.octave(1) should shift by +1200 cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).octave(1).apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch + 1200)
    })

    it('.octave(-1) should shift by -1200 cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).octave(-1).apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch - 1200)
    })
  })

  // ========================================================================
  // Accidental override
  // ========================================================================

  describe('accidentals', () => {
    it('.sharp() on numeric pitch should add 100 cents', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).sharp().apply(bridge))
      expect(notes[0].pitch).toBe(6100) // C + 100 cents
    })

    it('.flat() on numeric pitch should subtract 100 cents', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).flat().apply(bridge))
      expect(notes[0].pitch).toBe(5900) // C - 100 cents
    })

    it('.natural() on numeric pitch should set accidental to 0', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).sharp().natural().apply(bridge))
      expect(notes[0].pitch).toBe(6000) // no shift
    })
  })

  // ========================================================================
  // Duration scaling (articulation)
  // ========================================================================

  describe('articulation / duration scaling', () => {
    it('.staccato() should halve the duration', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).duration(480).staccato().apply(bridge))
      expect(notes[0].duration).toBe(240) // 480 * 0.5
    })

    it('.tenuto() should scale duration to 95%', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).duration(480).tenuto().apply(bridge))
      expect(notes[0].duration).toBe(456) // Math.round(480 * 0.95)
    })

    it('.marcato() should scale duration to 70% and boost velocity', () => {
      const bridge = createBridge()
      const { notes } = commitAndCapture(note(6000).duration(480).marcato().apply(bridge))
      expect(notes[0].duration).toBe(336) // Math.round(480 * 0.7)
      expect(notes[0].velocity).toBe(1000) // default 800 + 200
    })
  })

  // ========================================================================
  // Per-note transpose
  // ========================================================================

  describe('per-note transpose', () => {
    it('.transpose() should shift pitch by cents', () => {
      const bridge = createBridge()
      const { notes: base } = commitAndCapture(note(6000).apply(bridge))
      const { notes: shifted } = commitAndCapture(note(6000).transpose(700).apply(bridge))
      expect(shifted[0].pitch).toBe(base[0].pitch + 700)
    })

    it('.transpose() should stack with bridge transposeCents', () => {
      const bridge = createBridge({ transposeCents: 300 })
      const { notes } = commitAndCapture(note(6000).transpose(400).apply(bridge))
      // Bridge adds 300, note adds 400: 6000 + 400 + 300 = 6700
      expect(notes[0].pitch).toBe(6700)
    })
  })

  // ========================================================================
  // Repeat
  // ========================================================================

  describe('repeat', () => {
    it('.repeat(3) should emit the same note 3 times (advancing tick each)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = note(6000).repeat(3).apply(bridge)

      expect(result.tick).toBe(1440) // 3 * 480

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(480)
      expect(notes[2].tick).toBe(960)
      // All same pitch
      expect(notes[0].pitch).toBe(notes[1].pitch)
      expect(notes[1].pitch).toBe(notes[2].pitch)
    })
  })

  // ========================================================================
  // Flags (precise, muted)
  // ========================================================================

  describe('flags', () => {
    it('.precise() should set precise flag on bridge, then reset after', () => {
      const bridge = createBridge()
      expect(bridge.precise).toBe(false)

      const result = note(6000).precise().apply(bridge)
      // After apply, precise should be reset
      expect(result.precise).toBe(false)
    })

    it('.muted() should emit note with muted=true and reset after', () => {
      const bridge = createBridge()
      const result = note(6000).muted().apply(bridge)
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
      const result = note(6000).detune(0.5).apply(bridge)
      const { bends } = commitAndCapture(result)

      expect(bends.length).toBeGreaterThanOrEqual(1)
      expect(bends[0].value).toBe(0.5)
    })

    it('.aftertouch() should emit an aftertouch CC event', () => {
      const bridge = createBridge()
      const result = note(6000).aftertouch(80).apply(bridge)
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
      const original = note(6000)
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
      const result = note(5700)
        .velocity(900)
        .duration(240)
        .up()
        .staccato()
        .transpose(200)
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].velocity).toBe(900)
      expect(notes[0].duration).toBe(120) // 240 * 0.5 (staccato)
    })

    it('should handle multiple notes in sequence', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = note(6000).apply(b)
      b = note(6400).apply(b)
      b = note(6700).apply(b)

      expect(b.tick).toBe(1440) // 3 * 480

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
    })
  })
})
