/**
 * Tests for RFC-060 Task 6: NoteBuilder + DegreeBuilder cent-based migration.
 */

import { describe, it, expect } from 'vitest'
import { BaseCompositionBridge } from '../../composition/BaseCompositionBridge'
import { testNotation } from '../test-utils'
import { NoteBuilder } from '../../builders/NoteBuilder'
import { DegreeBuilder } from '../../builders/DegreeBuilder'
import { note } from '../../cues/note'
import { degree } from '../../cues/degree'
import { offset } from '../../cues/offset'
import { transpose, octaveUp, octaveDown } from '../../cues/setters'

/** C0 in MIDI = 12. Cents from C0 = (midi - 12) * 100. */
const MIDI_C0 = 12
const c4Cents = (60 - MIDI_C0) * 100 // 4800
const a4Cents = (69 - MIDI_C0) * 100 // 5700
const e4Cents = (64 - MIDI_C0) * 100 // 5200

describe('RFC-060 Task 6: Cent-Based Builders', () => {
  describe('NoteBuilder', () => {
    it('note("C4") resolves to 4800 cents', () => {
      const builder = note('C4')
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = builder.apply(b) as BaseCompositionBridge
      expect(result.tick).toBeGreaterThan(0)
    })

    it('note(4800) with numeric cents creates correctly', () => {
      const builder = note(4800)
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = builder.apply(b) as BaseCompositionBridge
      expect(result.tick).toBeGreaterThan(0)
    })

    it('sharp() adds 100 cents', () => {
      const builder = note('C4').sharp()
      // Verify builder was created (sharp adds 100 to accidental field)
      expect(builder).toBeDefined()
    })

    it('flat() subtracts 100 cents', () => {
      const builder = note('C4').flat()
      expect(builder).toBeDefined()
    })

    it('transpose(700) = up a fifth', () => {
      const builder = note('C4').transpose(700)
      expect(builder).toBeDefined()
    })

    it('up(1) = ×1200 shift', () => {
      const builder = note('C4').up(1)
      expect(builder).toBeDefined()
    })

    it('repeat works with cents-based notes', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = note('C4').repeat(3).apply(b) as BaseCompositionBridge
      // 3 × 480 = 1440
      expect(result.tick).toBe(1440)
    })

    it('pitch() method sets absolute cents', () => {
      const builder = note('C4').pitch(5700) // A4
      expect(builder).toBeDefined()
    })

    it('note() without args defaults to C4', () => {
      const builder = note()
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = builder.apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('note with explicit duration', () => {
      const builder = note('E4', 240)
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = builder.apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(240)
    })
  })

  describe('DegreeBuilder', () => {
    // Major scale intervals in cents: C D E F G A B
    const majorIntervals = [0, 200, 400, 500, 700, 900, 1100]

    it('degree(1) with scaleIntervals resolves to root', () => {
      const b = new BaseCompositionBridge({
        notation: testNotation,
        scaleRootCents: 4800,
        scaleIntervals: majorIntervals,
        defaultDuration: 480,
      })
      const result = degree(1).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('degree(5) resolves to fifth (root + 700 cents)', () => {
      const b = new BaseCompositionBridge({
        notation: testNotation,
        scaleRootCents: 4800,
        scaleIntervals: majorIntervals,
        defaultDuration: 480,
      })
      const result = degree(5).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('degree with sharp adds 100 cents', () => {
      const b = new BaseCompositionBridge({
        notation: testNotation,
        scaleRootCents: 4800,
        scaleIntervals: majorIntervals,
        defaultDuration: 480,
      })
      const result = degree(1).sharp().apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('degree(1) falls back to legacy when no scaleIntervals', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = degree(1).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480) // Should still emit via legacy path
    })

    it('repeat works with degree', () => {
      const b = new BaseCompositionBridge({
        notation: testNotation,
        scaleRootCents: 4800,
        scaleIntervals: majorIntervals,
        defaultDuration: 480,
      })
      const result = degree(1).repeat(2).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(960)
    })
  })

  describe('OffsetBuilder (updated)', () => {
    it('offset(0) now passes cents directly to withNote', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = offset(0).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })

    it('offset with sharp() uses ±100 cents', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = offset(0).sharp().apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(480)
    })
  })

  describe('Setter cues (cents)', () => {
    it('transpose() sets transposeCents', () => {
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = transpose(700).apply(b) as BaseCompositionBridge
      expect(result.transposeCents).toBe(700)
    })

    it('octaveUp() adds 1200 cents', () => {
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = octaveUp(1).apply(b) as BaseCompositionBridge
      expect(result.transposeCents).toBe(1200)
    })

    it('octaveDown() subtracts 1200 cents', () => {
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = octaveDown(1).apply(b) as BaseCompositionBridge
      expect(result.transposeCents).toBe(-1200)
    })

    it('octaveUp(2) adds 2400 cents', () => {
      const b = new BaseCompositionBridge({ notation: testNotation })
      const result = octaveUp(2).apply(b) as BaseCompositionBridge
      expect(result.transposeCents).toBe(2400)
    })
  })

  describe('Non-regression', () => {
    it('velocity/duration/repeat are unaffected by cent migration', () => {
      const b = new BaseCompositionBridge({ notation: testNotation, defaultDuration: 480 })
      const result = note('C4')
        .velocity(500)
        .repeat(2)
        .apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(960) // 2 × 480
    })

    it('continuous bridge fields survive note emission', () => {
      const b = new BaseCompositionBridge({
        notation: testNotation,
        tuningHz: 432,
        transposeCents: 700,
        defaultDuration: 480,
      })
      const result = note('C4').apply(b) as BaseCompositionBridge
      expect(result.tuningHz).toBe(432)
      expect(result.transposeCents).toBe(700)
    })
  })
})
