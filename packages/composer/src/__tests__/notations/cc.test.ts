/**
 * CC cue Test — cc(controller, value), detune, timbre, pressure return PipeStep
 *
 * Tests the cc() cue and its convenience wrappers (detune, timbre, pressure)
 * that emit MIDI control change events via bridge.withCC().
 */

import { describe, it, expect } from 'vitest'
import { cc, detune, timbre, pressure } from '../../cues/cc'
import { note } from '../../cues/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory-legacy'

describe('cc', () => {

  describe('cc(controller, value)', () => {
    it('should emit CC event with given controller and value', () => {
      const bridge = createBridge()
      const result = cc(7, 80).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(7)
      expect(capturedCC[0].value).toBe(80)
    })

    it('should chain with notes — CC then note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = cc(MIDI_CC.VOLUME, 64).apply(bridge)
      b = note(6000).apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)
      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.VOLUME)
      expect(capturedCC[0].value).toBe(64)
    })

    it('should emit multiple CC events in sequence', () => {
      const bridge = createBridge()
      let b = cc(1, 50).apply(bridge)
      b = cc(74, 100).apply(b)

      const { cc: capturedCC } = commitAndCapture(b)
      expect(capturedCC).toHaveLength(2)
      expect(capturedCC[0]).toMatchObject({ controller: 1, value: 50 })
      expect(capturedCC[1]).toMatchObject({ controller: 74, value: 100 })
    })
  })

  describe('detune (CC1 modulation)', () => {
    it('should emit CC MODULATION (1) with value', () => {
      const bridge = createBridge()
      const result = detune(64).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.MODULATION)
      expect(capturedCC[0].value).toBe(64)
    })

    it('should chain with note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = detune(100).apply(bridge)
      b = note(6000).apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.MODULATION)
      expect(capturedCC[0].value).toBe(100)
    })
  })

  describe('timbre (CC74 brightness)', () => {
    it('should emit CC BRIGHTNESS (74) with value', () => {
      const bridge = createBridge()
      const result = timbre(80).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.BRIGHTNESS)
      expect(capturedCC[0].value).toBe(80)
    })

    it('should chain with note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = timbre(50).apply(bridge)
      b = note(6400).apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6400)
      expect(capturedCC[0].controller).toBe(MIDI_CC.BRIGHTNESS)
    })
  })

  describe('pressure (CC13 effect 2)', () => {
    it('should emit CC EFFECT_2 (13) with value', () => {
      const bridge = createBridge()
      const result = pressure(127).apply(bridge)
      const { cc: capturedCC } = commitAndCapture(result)

      expect(capturedCC).toHaveLength(1)
      expect(capturedCC[0].controller).toBe(MIDI_CC.EFFECT_2)
      expect(capturedCC[0].value).toBe(127)
    })

    it('should chain with note', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b = pressure(0).apply(bridge)
      b = note(6700).apply(b)

      const { notes, cc: capturedCC } = commitAndCapture(b)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6700)
      expect(capturedCC[0].controller).toBe(MIDI_CC.EFFECT_2)
      expect(capturedCC[0].value).toBe(0)
    })
  })
})
