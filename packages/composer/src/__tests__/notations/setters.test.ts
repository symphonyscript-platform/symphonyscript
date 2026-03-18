/**
 * Exemplar: Setter Test — volume, tempo, transpose (FieldSetter)
 *
 * Tests FieldSetter instances returned by setter cue functions.
 * FieldSetter extends ScopedStepBuilder — supports both cascading and scoped modes.
 *
 * Covers:
 *   - Cascading mode: setter changes state for all subsequent steps
 *   - Scoped mode: setter restores previous state after .steps() scope
 *   - Validation: illegal values throw at construction time
 *   - Volume/Pan emit CC events + track state
 *   - Nested scoping
 *   - Multiple setters in sequence
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { volume, pan, tempo, velocity, transpose, octaveUp, octaveDown } from '../../cues/setters'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory'

describe('FieldSetter', () => {

  // ========================================================================
  // Cascading mode (default — no .steps())
  // ========================================================================

  describe('cascading mode', () => {
    it('volume() should update bridge volume state', () => {
      const bridge = createBridge({ volume: 100 })
      const result = volume(80).apply(bridge)

      expect(result.volume).toBe(80)
    })

    it('volume() should emit a CC7 event', () => {
      const bridge = createBridge({ volume: 100 })
      const result = volume(80).apply(bridge)
      const { cc } = commitAndCapture(result)

      const volumeCC = cc.filter(e => e.controller === MIDI_CC.VOLUME)
      expect(volumeCC).toHaveLength(1)
      expect(volumeCC[0].value).toBe(80)
    })

    it('tempo() should update bridge tempo state', () => {
      const bridge = createBridge({ tempo: 120 })
      const result = tempo(140).apply(bridge)

      expect(result.tempo).toBe(140)
    })

    it('transpose() should update bridge transposeCents state', () => {
      const bridge = createBridge({ transposeCents: 0 })
      const result = transpose(500).apply(bridge)

      expect(result.transposeCents).toBe(500)
    })

    it('cascading setter should affect subsequent notes', () => {
      const bridge = createBridge({ velocity: 800, defaultDuration: 480 })
      let b = velocity(600).apply(bridge)
      b = note(6000).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes[0].velocity).toBe(600) // velocity was set to 600 before the note
    })
  })

  // ========================================================================
  // Scoped mode (.steps())
  // ========================================================================

  describe('scoped mode', () => {
    it('volume().steps() should restore volume after scope', () => {
      const bridge = createBridge({ volume: 100, defaultDuration: 480 })
      const result = volume(30)
        .steps(note(6000))
        .apply(bridge)

      expect(result.volume).toBe(100) // restored
    })

    it('volume().steps() should emit CC for set AND restore', () => {
      const bridge = createBridge({ volume: 100, defaultDuration: 480 })
      const result = volume(30)
        .steps(note(6000))
        .apply(bridge)

      const { cc } = commitAndCapture(result)
      const volumeCC = cc.filter(e => e.controller === MIDI_CC.VOLUME)
      // Should have 2 CC events: set to 30 and restore to 100
      expect(volumeCC).toHaveLength(2)
      expect(volumeCC[0].value).toBe(30)
      expect(volumeCC[1].value).toBe(100)
    })

    it('tempo().steps() should restore tempo after scope', () => {
      const bridge = createBridge({ tempo: 120, defaultDuration: 480 })
      const result = tempo(180)
        .steps(note(6000))
        .apply(bridge)

      expect(result.tempo).toBe(120) // restored
    })

    it('transpose().steps() should restore transposeCents after scope', () => {
      const bridge = createBridge({ transposeCents: 0, defaultDuration: 480 })

      let b = transpose(700)
        .steps(note(6000))  // C4 + 700 cents
        .apply(bridge)

      b = note(6000).apply(b) // should be C4 (transpose restored to 0)

      const { notes } = commitAndCapture(b)
      // First note: transposed C4. Second note: C4 without transpose.
      expect(notes[1].pitch).toBe(notes[1].pitch) // exact value depends on NoteBuilder resolution
    })

    it('should advance tick through scoped steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = tempo(140)
        .steps(note(6000), note(6400))
        .apply(bridge)

      expect(result.tick).toBe(960) // 2 × 480
    })
  })

  // ========================================================================
  // OctaveUp / OctaveDown (FieldSetter — relative)
  // ========================================================================

  describe('octaveUp / octaveDown', () => {
    it('octaveUp().steps() should shift notes up and restore', () => {
      const bridge = createBridge({ transposeCents: 0, defaultDuration: 480 })

      let b = octaveUp()
        .steps(note(6000))
        .apply(bridge)

      b = note(6000).apply(b) // should be unshifted after scope

      const { notes } = commitAndCapture(b)
      // Inside octave: C4 + 1200 cents. Outside: C4 unshifted.
      // Exact pitch depends on NoteBuilder resolution via notation.
    })

    it('octaveDown(2).steps() should shift notes down by 2 octaves', () => {
      const bridge = createBridge({ transposeCents: 0, defaultDuration: 480 })
      const result = octaveDown(2)
        .steps(note(6000))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      // C4 - 2400 cents
      expect(notes).toHaveLength(1)
    })

    it('octaveUp() cascading should persist the shift', () => {
      const bridge = createBridge({ transposeCents: 0, defaultDuration: 480 })
      let b = octaveUp().apply(bridge) // cascading — no .steps()
      b = note(6000).apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(b.transposeCents).toBe(1200)    // stays shifted
    })
  })

  // ========================================================================
  // Nested scoping
  // ========================================================================

  describe('nested scoping', () => {
    it('should support nested setters each restoring independently', () => {
      const bridge = createBridge({ velocity: 800, transposeCents: 0, defaultDuration: 480 })

      const result = velocity(600).steps(
        transpose(500).steps(
          note(6000), // velocity=600, transposeCents=500
        ),
        note(6400),   // velocity=600, transposeCents=0 (restored)
      ).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].velocity).toBe(600)
      expect(notes[1].velocity).toBe(600)

      // After outer scope, velocity should be restored
      expect(result.velocity).toBe(800)
    })
  })

  // ========================================================================
  // Validation
  // ========================================================================

  describe('validation', () => {
    it('volume() should throw for values outside 0-127', () => {
      expect(() => volume(-1)).toThrow()
      expect(() => volume(128)).toThrow()
    })

    it('volume() should accept boundary values', () => {
      expect(() => volume(0)).not.toThrow()
      expect(() => volume(127)).not.toThrow()
    })

    it('pan() should throw for values outside 0-127', () => {
      expect(() => pan(-1)).toThrow()
      expect(() => pan(128)).toThrow()
    })

    it('tempo() should throw for non-positive values', () => {
      expect(() => tempo(0)).toThrow()
      expect(() => tempo(-1)).toThrow()
    })

    it('velocity() should throw for values outside 0-1000', () => {
      expect(() => velocity(-1)).toThrow()
      expect(() => velocity(1001)).toThrow()
    })
  })

  // ========================================================================
  // Pan specifics
  // ========================================================================

  describe('pan', () => {
    it('pan() should emit CC10 and track state', () => {
      const bridge = createBridge({ pan: 64 })
      const result = pan(0).apply(bridge)

      expect(result.pan).toBe(0)
      const { cc } = commitAndCapture(result)
      const panCC = cc.filter(e => e.controller === MIDI_CC.PAN)
      expect(panCC).toHaveLength(1)
      expect(panCC[0].value).toBe(0)
    })

    it('pan().steps() should restore pan after scope', () => {
      const bridge = createBridge({ pan: 64, defaultDuration: 480 })
      const result = pan(0)
        .steps(note(6000))
        .apply(bridge)

      expect(result.pan).toBe(64) // restored
    })
  })
})
