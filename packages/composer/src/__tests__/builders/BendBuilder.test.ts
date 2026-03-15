/**
 * Builder Test — BendBuilder
 *
 * Tests BendBuilder (returned by `bend()`), testing the builder
 * directly with createBridge + commitAndCapture.
 *
 * Covers:
 *   - .value() for pitch bend amount
 *   - .steps() for scoped bend application
 *   - Scoped bend (on enter sets bend, on exit resets to 0)
 *   - Chaining with note()
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { bend } from '../../notations/bend'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('BendBuilder', () => {

  describe('.value()', () => {
    it('should apply bend value to notes within scope', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(8192).steps(note('C4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(bends.some(b => b.value === 8192)).toBe(true)
    })

    it('bend(value).value(newValue) should override value', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(0).value(8192).steps(note('C4')).apply(bridge)

      const { bends } = commitAndCapture(result)
      expect(bends.some(b => b.value === 8192)).toBe(true)
    })

    it('should emit full bend value 16383', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(16383).steps(note('E4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(bends.some(b => b.value === 16383)).toBe(true)
    })

    it('should emit zero bend when value 0', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(0).steps(note('G4')).apply(bridge)

      const { bends } = commitAndCapture(result)
      expect(bends.some(b => b.value === 0)).toBe(true)
    })
  })

  describe('.steps()', () => {
    it('should apply bend to notes inside steps', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = bend(8192).steps(note('C4'), note('E4')).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(bends.some(b => b.value === 8192)).toBe(true)
    })

    it('bend() without steps should cascade (emit bend, no notes)', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = bend(8192).apply(bridge)

      const { notes, bends } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
      expect(bends.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('scoped bend', () => {
    it('bend should reset after scope — note outside scope should not have bend', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = bend(8192).steps(note('C4')).apply(bridge)
      b = note('E4').apply(b)

      const { notes, bends } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      // Should have bend set, note, bend reset, note
      expect(bends.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('chaining with note()', () => {
    it('should allow bend scope then note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = bend(4096).steps(note('C4')).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(67)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = bend(4096)
      const withValue = original.value(8192)
      const withSteps = original.steps(note('C4'))

      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const valResult = commitAndCapture(withValue.steps(note('C4')).apply(bridge))
      const stepsResult = commitAndCapture(withSteps.apply(bridge))

      expect(withValue).not.toBe(original)
      expect(withSteps).not.toBe(original)
      expect(valResult.bends.some(b => b.value === 8192)).toBe(true)
      expect(stepsResult.notes).toHaveLength(1)
    })
  })
})
