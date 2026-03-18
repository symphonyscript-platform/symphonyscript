/**
 * Builder Test — AftertouchBuilder
 *
 * Tests AftertouchBuilder (returned by `aftertouch()`), testing the builder
 * directly with createBridge + commitAndCapture.
 *
 * Covers:
 *   - Channel aftertouch (value only)
 *   - Poly aftertouch (value + note)
 *   - .value() and .note() chaining
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { aftertouch } from '../../cues/aftertouch'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'

const CC_CHANNEL_AFTERTOUCH = 0xd0
const CC_POLY_AFTERTOUCH = 0xa0

describe('AftertouchBuilder', () => {

  describe('channel aftertouch', () => {
    it('should emit channel aftertouch CC (0xD0) when no note specified', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents).toHaveLength(1)
      expect(atEvents[0].value).toBe(Math.round(0.5 * 127))
    })

    it('should map value 1 to 127', () => {
      const bridge = createBridge()
      const result = aftertouch(1).apply(bridge)
      const { cc } = commitAndCapture(result)
      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(127)
    })

    it('should map value 0 to 0', () => {
      const bridge = createBridge()
      const result = aftertouch(0).apply(bridge)
      const { cc } = commitAndCapture(result)
      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(0)
    })

    it('should clamp value to 0–1 range', () => {
      const bridge = createBridge()
      const result = aftertouch(1.5).apply(bridge)
      const { cc } = commitAndCapture(result)
      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(127)
    })
  })

  describe('poly aftertouch', () => {
    it('should emit poly aftertouch CC (0xA0) when note provided in constructor', () => {
      const bridge = createBridge()
      const result = aftertouch(0.8, 6000).apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(atEvents).toHaveLength(1)
      expect(atEvents[0].value).toBe(Math.round(0.8 * 127))
    })

    it('.note() should switch to poly aftertouch on target note', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).note(6400).apply(bridge)
      const { cc } = commitAndCapture(result)

      const polyEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(polyEvents).toHaveLength(1)
    })

    it('should emit poly aftertouch when note provided as second arg', () => {
      const bridge = createBridge()
      const result = aftertouch(0.8, 6000).apply(bridge)
      const { cc } = commitAndCapture(result)
      const polyEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(polyEvents).toHaveLength(1)
    })
  })

  describe('.value()', () => {
    it('should override initial value', () => {
      const bridge = createBridge()
      const result = aftertouch(0.3).value(0.9).apply(bridge)
      const { cc } = commitAndCapture(result)
      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(Math.round(0.9 * 127))
    })
  })

  describe('.note()', () => {
    it('should set target note for poly aftertouch', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).note(6700).apply(bridge)
      const { cc } = commitAndCapture(result)
      const polyEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(polyEvents).toHaveLength(1)
    })
  })

  describe('chaining with note() cue', () => {
    it('should allow aftertouch then note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = aftertouch(0.5).apply(bridge)
      b = note(6000).apply(b)
      const { notes, cc } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)).toHaveLength(1)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = aftertouch(0.5)
      const withValue = original.value(0.9)
      const withNote = original.note(6000)

      const bridge = createBridge()
      const origResult = commitAndCapture(original.apply(bridge))
      const valResult = commitAndCapture(withValue.apply(bridge))
      const noteResult = commitAndCapture(withNote.apply(bridge))

      expect(origResult.cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)[0].value).toBe(Math.round(0.5 * 127))
      expect(valResult.cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)[0].value).toBe(Math.round(0.9 * 127))
      expect(noteResult.cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)).toHaveLength(1)
    })
  })
})
