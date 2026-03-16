/**
 * Aftertouch Notation Test — aftertouch(value, note?)
 *
 * Channel aftertouch (value only) or poly aftertouch (value + note).
 * Value range 0–1, mapped to 0–127.
 */

import { describe, it, expect } from 'vitest'
import { aftertouch } from '../../cues/aftertouch'
import { note } from '../../cues/note'
import { AftertouchBuilder } from '../../builders/AftertouchBuilder'
import { createBridge, commitAndCapture } from '../test-utils'

// Channel aftertouch uses controller 0xD0
const CC_CHANNEL_AFTERTOUCH = 0xd0
// Poly aftertouch uses controller 0xA0 (per-note pressure)
const CC_POLY_AFTERTOUCH = 0xa0

describe('aftertouch', () => {

  describe('return type', () => {
    it('aftertouch(0.5) should return AftertouchBuilder', () => {
      const result = aftertouch(0.5)
      expect(result).toBeInstanceOf(AftertouchBuilder)
    })

    it('aftertouch(0.8, "C4") should return AftertouchBuilder', () => {
      const result = aftertouch(0.8, 'C4')
      expect(result).toBeInstanceOf(AftertouchBuilder)
    })
  })

  describe('channel aftertouch', () => {
    it('aftertouch(0.5) should emit channel aftertouch CC (0xD0)', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents).toHaveLength(1)
      expect(atEvents[0].value).toBe(Math.round(0.5 * 127))  // 63 or 64
    })

    it('aftertouch(1) should map to 127', () => {
      const bridge = createBridge()
      const result = aftertouch(1).apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(127)
    })

    it('aftertouch(0) should map to 0', () => {
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
    it('aftertouch(0.8, "C4") should emit poly aftertouch CC (0xA0)', () => {
      const bridge = createBridge()
      const result = aftertouch(0.8, 'C4').apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(atEvents).toHaveLength(1)
      expect(atEvents[0].value).toBe(Math.round(0.8 * 127))
    })

    it('aftertouch(0.5).note("E4") should set target note', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).note('E4').apply(bridge)
      const { cc } = commitAndCapture(result)

      const atEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(atEvents).toHaveLength(1)
    })
  })

  describe('builder chaining', () => {
    it('.value() should override value', () => {
      const bridge = createBridge()
      const result = aftertouch(0.3).value(0.9).apply(bridge)
      const { cc } = commitAndCapture(result)
      const atEvents = cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)
      expect(atEvents[0].value).toBe(Math.round(0.9 * 127))
    })

    it('.note() should switch to poly aftertouch', () => {
      const bridge = createBridge()
      const result = aftertouch(0.5).note('G4').apply(bridge)
      const { cc } = commitAndCapture(result)
      const polyEvents = cc.filter(e => e.controller === CC_POLY_AFTERTOUCH)
      expect(polyEvents).toHaveLength(1)
    })
  })

  describe('chaining with notes', () => {
    it('should allow aftertouch then note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = aftertouch(0.5).apply(bridge)
      b = note('C4').apply(b)
      const { notes, cc } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(cc.filter(e => e.controller === CC_CHANNEL_AFTERTOUCH)).toHaveLength(1)
    })
  })
})
