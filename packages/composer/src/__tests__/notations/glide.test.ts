/**
 * Glide Notation Test — glide(...steps) wraps in GlideBridge per step
 *
 * glide() creates a new GlideBridge per step, so each step gets a fresh wrapper.
 * Actual behavior: each note adds CC PORTAMENTO 127 (no shared flush 0).
 * - Single note: 1 CC (127)
 * - 3 notes: 3 CCs (each 127)
 */

import { describe, it, expect } from 'vitest'
import { glide } from '../../notations/glide'
import { note } from '../../notations/note'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory'

describe('glide', () => {

  describe('glide(...steps) wraps in GlideBridge per step', () => {
    it('single note: one CC PORTAMENTO 127', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = glide(note('C4')).apply(bridge)

      const { notes, cc } = commitAndCapture(result)
      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60)

      expect(cc).toHaveLength(1)
      expect(cc[0].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[0].value).toBe(127)
    })

    it('multiple notes: one CC 127 per note', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      const result = glide(note('C4'), note('E4'), note('G4')).apply(bridge)

      const { notes, cc } = commitAndCapture(result)
      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
      expect(notes[2].pitch).toBe(67)

      expect(cc).toHaveLength(3)
      expect(cc[0]).toMatchObject({ controller: MIDI_CC.PORTAMENTO, value: 127 })
      expect(cc[1]).toMatchObject({ controller: MIDI_CC.PORTAMENTO, value: 127 })
      expect(cc[2]).toMatchObject({ controller: MIDI_CC.PORTAMENTO, value: 127 })
    })

    it('should advance tick through glided steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = glide(note('C4'), note('E4')).apply(bridge)

      expect(result.tick).toBe(960)
    })

    it('should allow subsequent steps outside glide', () => {
      const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
      let b = glide(note('C4'), note('E4')).apply(bridge)
      b = note('G4').apply(b)

      const { notes } = commitAndCapture(b)
      expect(notes).toHaveLength(3)
      expect(notes[2].pitch).toBe(67)
    })
  })
})
