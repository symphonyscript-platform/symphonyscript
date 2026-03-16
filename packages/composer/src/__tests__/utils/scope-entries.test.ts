/**
 * Tests for scope-entries utilities: appendSteps and applyEntries.
 *
 * Covers:
 *   - appendSteps: returns new array without mutating original, appends pipeSteps
 *   - applyEntries: iterates entries and steps in order, applies each step sequentially
 */

import { describe, it, expect } from 'vitest'
import { appendSteps, applyEntries } from '../../utils/scope-entries'
import { step } from '../../utils/step'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('scope-entries', () => {

  describe('appendSteps', () => {

    it('returns new array without mutating original', () => {
      const entries: ReturnType<typeof step>[][] = []
      const pipeSteps = [step((b) => b)]

      const result = appendSteps(entries, pipeSteps)

      expect(result).not.toBe(entries)
      expect(entries).toHaveLength(0)
      expect(result).toHaveLength(1)
    })

    it('appends pipeSteps as last element', () => {
      const stepA = step((b) => b)
      const stepB = step((b) => b)
      const entries = [[stepA]]
      const pipeSteps = [stepB]

      const result = appendSteps(entries, pipeSteps)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual([stepA])
      expect(result[1]).toEqual([stepB])
    })

    it('handles empty entries', () => {
      const pipeSteps = [step((b) => b)]
      const result = appendSteps([], pipeSteps)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(pipeSteps)
    })

    it('handles empty pipeSteps', () => {
      const entries = [[step((b) => b)]]
      const result = appendSteps(entries, [])

      expect(result).toHaveLength(2)
      expect(result[1]).toEqual([])
    })
  })

  describe('applyEntries', () => {

    it('returns bridge unchanged when entries are empty', () => {
      const bridge = createBridge({ velocity: 600 })
      const result = applyEntries([], bridge)

      expect(result).toBe(bridge)
    })

    it('applies single step in single entry', () => {
      const bridge = createBridge({ velocity: 400 })
      const applySpy = (b: ReturnType<typeof createBridge>) => b.withVelocity(800)
      const entries = [[step(applySpy)]]

      const result = applyEntries(entries, bridge)

      expect(result.velocity).toBe(800)
    })

    it('applies steps in order within an entry', () => {
      const bridge = createBridge({ velocity: 100, transpose: 0 })
      const step1 = step((b) => b.withVelocity(200))
      const step2 = step((b) => b.withTranspose(5))
      const entries = [[step1, step2]]

      const result = applyEntries(entries, bridge)

      expect(result.velocity).toBe(200)
      expect(result.transpose).toBe(5)
    })

    it('applies entries in order', () => {
      const bridge = createBridge({ velocity: 100 })
      const step1 = step((b) => b.withVelocity(300))
      const step2 = step((b) => b.withVelocity(700))
      const entries = [[step1], [step2]]

      const result = applyEntries(entries, bridge)

      expect(result.velocity).toBe(700)
    })

    it('produces committed notes when using note steps', () => {
      const bridge = createBridge({ velocity: 600 })
      const entries = [[note('C4')]]

      const result = applyEntries(entries, bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(notes[0].velocity).toBe(600)
    })
  })
})
