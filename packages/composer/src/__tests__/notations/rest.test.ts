/**
 * Rest Notation Test — rest(duration) advances tick
 *
 * Tests the rest() notation that returns a PipeStep advancing the bridge tick
 * by the given duration without emitting notes.
 */

import { describe, it, expect } from 'vitest'
import { rest } from '../../notations/rest'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'

describe('rest', () => {

  describe('rest(duration) advances tick', () => {
    it('should advance tick by duration', () => {
      const bridge = createBridge({ tick: 0 })
      const result = rest(480).apply(bridge)

      expect(result.tick).toBe(480)
    })

    it('should not emit any notes', () => {
      const bridge = createBridge()
      const result = rest(480).apply(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(0)
    })

    it('should advance tick by arbitrary duration', () => {
      const bridge = createBridge({ tick: 100 })
      const result = rest(240).apply(bridge)

      expect(result.tick).toBe(340)
    })

    it('should chain with notes — rest then note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = rest(480).apply(bridge)
      b = note('C4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)
      expect(notes[0].tick).toBe(480)
      expect(b.tick).toBe(960)
    })

    it('should chain note then rest — tick advances after rest', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = note('C4').apply(bridge)
      b = rest(240).apply(b)

      expect(b.tick).toBe(720) // 480 + 240
      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].tick).toBe(0)
    })
  })
})
