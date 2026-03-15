/**
 * Error / negative path tests
 *
 * Documents actual runtime behavior for invalid or edge-case inputs:
 *   - arpeggio(['invalid']) — throws (resolvePitches propagates)
 *   - roman('XXVII') / roman('invalid') — throws (ROMAN_DEGREE_MAP lookup yields undefined)
 *   - stretch(-1) / stretch(0) — observed behavior
 *   - degree(-1) / degree(999) — observed behavior
 *   - resolvePitch('invalid') — throws
 *   - parseChord('') — throws
 */

import { describe, it, expect } from 'vitest'
import { ScaleMode } from '@symphonyscript/theory'
import { arpeggio } from '../notations/arpeggio'
import { roman } from '../notations/roman'
import { stretch } from '../notations/stretch'
import { degree } from '../notations/degree'
import { note } from '../notations/note'
import { resolvePitch } from '../utils/pitch'
import { parseChord } from '../utils/chord'
import { createBridge, commitAndCapture } from './test-utils'

describe('error-paths', () => {

  describe('arpeggio', () => {
    it('arpeggio([\'invalid\']) — throws on apply (resolvePitches propagates)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      expect(() => arpeggio(['invalid' as any]).apply(bridge)).toThrow()
      expect(() => arpeggio(['invalid' as any]).apply(bridge)).toThrow('Invalid note name: invalid')
    })
  })

  describe('roman', () => {
    it('roman(\'XXVII\') — throws on apply (invalid numeral not in ROMAN_DEGREE_MAP)', () => {
      const bridge = createBridge({ scaleRoot: 0, scaleMode: ScaleMode.MAJOR, defaultDuration: 480 })
      const romanWithInvalid = roman as (n?: string) => ReturnType<typeof roman>
      expect(() => romanWithInvalid('XXVII').apply(bridge)).toThrow()
    })

    it('roman(\'invalid\') — throws on apply (invalid numeral)', () => {
      const bridge = createBridge({ scaleRoot: 0, scaleMode: ScaleMode.MAJOR, defaultDuration: 480 })
      const romanWithInvalid = roman as (n?: string) => ReturnType<typeof roman>
      expect(() => romanWithInvalid('invalid').apply(bridge)).toThrow()
    })
  })

  describe('stretch', () => {
    it('stretch(-1) — applies (negative factor produces negative ticks/durations)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch(-1).steps(note('C4'), note('E4')).apply(bridge)
      const { notes } = commitAndCapture(result)
      // stretch(-1): tick and duration multiplied by -1
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(-480)
      // Second note (C4) at tick 0; first (E4) at tick -480 due to negative factor
      expect(notes[0].tick).toBeLessThanOrEqual(0)
    })

    it('stretch(0) — applies (zero duration, notes overlap at tick 0)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = stretch(0).steps(note('C4'), note('E4')).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].duration).toBe(0)
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(0)
    })
  })

  describe('degree', () => {
    it('degree(-1) — applies (degreeToPitch wraps negative via modulo, emits one note)', () => {
      const bridge = createBridge({ scaleRoot: 0, scaleMode: ScaleMode.MAJOR, defaultDuration: 480 })
      const result = degree(-1).apply(bridge)
      const { notes } = commitAndCapture(result)
      // degreeToPitch(-1): idx=-2 -> baseIdx 5 in C major (A) -> valid pitch, one note
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBeGreaterThanOrEqual(0)
      expect(notes[0].pitch).toBeLessThanOrEqual(127)
      expect(notes[0].duration).toBe(480)
    })

    it('degree(999) — applies (degreeToPitch wraps to very high octave)', () => {
      const bridge = createBridge({ scaleRoot: 0, scaleMode: ScaleMode.MAJOR, defaultDuration: 480 })
      const result = degree(999).apply(bridge)
      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(1771) // Locks: degree 999 in C major → specific pitch
    })
  })

  describe('resolvePitch', () => {
    it('resolvePitch(\'invalid\') — throws', () => {
      expect(() => resolvePitch('invalid' as any)).toThrow()
      expect(() => resolvePitch('invalid' as any)).toThrow('Invalid note name: invalid')
    })
  })

  describe('parseChord', () => {
    it('parseChord(\'\') — throws', () => {
      expect(() => parseChord('')).toThrow()
      expect(() => parseChord('')).toThrow('Empty chord symbol')
    })
  })
})
