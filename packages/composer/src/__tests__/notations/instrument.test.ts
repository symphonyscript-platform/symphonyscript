/**
 * Instrument Notation Test — sustain(), release(), modWheel(), breath(), expression(), bendReset()
 *
 * Tests instrument control notations that emit MIDI CC events and pitch bend via bridge.
 */

import { describe, it, expect } from 'vitest'
import { sustain, release, modWheel, breath, expression, bendReset } from '../../notations/instrument'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory'

describe('instrument', () => {

  describe('sustain', () => {
    it('should emit CC64 SUSTAIN at 127', () => {
      const bridge = createBridge()
      const result = sustain().apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.SUSTAIN)
      expect(capturedCC[0].controller).toBe(64)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should chain with notes', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = sustain().apply(bridge)
      b = note('C4').apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.SUSTAIN)
      expect(capturedCC[0].value).toBe(127)
    })
  })

  describe('release', () => {
    it('should emit CC64 SUSTAIN at 0', () => {
      const bridge = createBridge()
      const result = release().apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.SUSTAIN)
      expect(capturedCC[0].value).toBe(0)
    })

    it('should chain sustain then release', () => {
      const bridge = createBridge()
      let b = sustain().apply(bridge)
      b = release().apply(b)

      const { cc: capturedCC } = commitAndCapture(b)
      expect(capturedCC).toHaveLength(2)
      expect(capturedCC[0]).toMatchObject({ controller: MIDI_CC.SUSTAIN, value: 127 })
      expect(capturedCC[1]).toMatchObject({ controller: MIDI_CC.SUSTAIN, value: 0 })
    })
  })

  describe('modWheel', () => {
    it('should emit CC1 MODULATION with given amount', () => {
      const bridge = createBridge()
      const result = modWheel(64).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.MODULATION)
      expect(capturedCC[0].controller).toBe(1)
      expect(capturedCC[0].value).toBe(64)
    })

    it('should accept 0–127 range', () => {
      const bridge = createBridge()
      const result0 = modWheel(0).apply(bridge)
      const result127 = modWheel(127).apply(createBridge())

      const { cc: cc0 } = commitAndCapture(result0)
      const { cc: cc127 } = commitAndCapture(result127)

      expect(cc0[0].value).toBe(0)
      expect(cc127[0].value).toBe(127)
    })

    it('should chain with note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = modWheel(100).apply(bridge)
      b = note('E4').apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.MODULATION)
      expect(capturedCC[0].value).toBe(100)
    })
  })

  describe('breath', () => {
    it('should emit CC2 BREATH with given amount', () => {
      const bridge = createBridge()
      const result = breath(80).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.BREATH)
      expect(capturedCC[0].value).toBe(80)
    })
  })

  describe('expression', () => {
    it('should emit CC11 EXPRESSION with given amount', () => {
      const bridge = createBridge()
      const result = expression(90).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.EXPRESSION)
      expect(capturedCC[0].value).toBe(90)
    })
  })

  describe('bendReset', () => {
    it('should emit pitch bend 0', () => {
      const bridge = createBridge()
      const result = bendReset().apply(bridge)
      const { bends } = commitAndCapture(result)

      expect(bends).toHaveLength(1)
      expect(bends[0].value).toBe(0)
    })

    it('should chain with note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = bendReset().apply(bridge)
      b = note('C4').apply(b)

      const { notes, bends } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(bends).toHaveLength(1)
      expect(bends[0].value).toBe(0)
    })
  })
})
