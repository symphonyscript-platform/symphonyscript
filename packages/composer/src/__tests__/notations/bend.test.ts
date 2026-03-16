/**
 * Bend cue Test — bend(value) BendBuilder
 *
 * Tests the bend() cue that wraps steps in a pitch-bend scope.
 * BendBuilder applies the bend value on enter and resets to 0 on exit.
 */

import { describe, it, expect } from 'vitest'
import { bend } from '../../cues/bend'
import { BendBuilder } from '../../builders/BendBuilder'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('bend', () => {

  describe('return type', () => {
    it('bend() should return BendBuilder', () => {
      const result = bend()
      expect(result).toBeInstanceOf(BendBuilder)
    })

    it('bend(value) should return BendBuilder', () => {
      const result = bend(8192)
      expect(result).toBeInstanceOf(BendBuilder)
    })
  })

  describe('bend scoped to steps', () => {
    it('bend(8192).steps(note("C4")) should emit bend then note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(8192).steps(note('C4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(bends.length).toBeGreaterThanOrEqual(1)
      expect(bends.some(b => b.value === 8192)).toBe(true)
    })

    it('bend(16383).steps(note("E4")) should emit full bend value', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(16383).steps(note('E4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(64)
      expect(bends.some(b => b.value === 16383)).toBe(true)
    })

    it('bend(0).steps(note("G4")) should emit zero bend', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(0).steps(note('G4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(67)
      expect(bends.some(b => b.value === 0)).toBe(true)
    })

    it('bend() without steps should cascade (no notes)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = bend(8192).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(bends.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('bend resets after scope', () => {
    it('bend then note outside scope should not have bend on subsequent note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = bend(8192).steps(note('C4')).apply(bridge)
      b = note('E4').apply(b)

      const { notes, bends } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(bends.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('builder chain', () => {
    it('bend(value).value(newValue) should override', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(0).value(8192).steps(note('C4')).apply(bridge)

      const { bends } = commitAndCapture(result)
      expect(bends.some(b => b.value === 8192)).toBe(true)
    })
  })
})
