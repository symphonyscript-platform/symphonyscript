/**
 * GlideBridge Test — Bridge Decorator
 *
 * Tests GlideBridge, a CompositionBridgeDecorator that enables portamento for
 * glide groups. First note sends CC PORTAMENTO 127, then emits; subsequent notes
 * just emit. flush() sends CC PORTAMENTO 0 when activated.
 *
 * Covers:
 *   - First note adds CC portamento 127
 *   - Subsequent notes emit (no additional CC)
 *   - flush() adds CC portamento 0 when activated
 *   - flush() when not activated does not add CC
 *   - visitCC captures CC events correctly
 */

import { describe, it, expect } from 'vitest'
import { GlideBridge } from '../../composition/GlideBridge'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory'

describe('GlideBridge', () => {

  function createGlideBridge(activated: boolean = false) {
    const bridge = createBridge({ defaultDuration: 480, velocity: 100 })
    return new GlideBridge(bridge, activated)
  }

  // ========================================================================
  // First note — CC portamento 127
  // ========================================================================

  describe('first note adds CC portamento 127', () => {
    it('should send CC PORTAMENTO 127 before first note when not activated', () => {
      const gb = createGlideBridge(false)

      const result = gb.withNote(6000, 480)
      const { notes, cc } = commitAndCapture(result)

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(6000)

      expect(cc).toHaveLength(1)
      expect(cc[0].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[0].value).toBe(127)
    })

    it('should order CC before note (visitCC captures in emission order)', () => {
      const gb = createGlideBridge(false)

      const result = gb.withNote(6000, 480)
      const { notes, cc } = commitAndCapture(result)

      expect(cc[0].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[0].value).toBe(127)
      expect(notes[0].pitch).toBe(6000)
      // CC should be at same or earlier tick than first note
      expect(cc[0].tick).toBeLessThanOrEqual(notes[0].tick)
    })
  })

  // ========================================================================
  // Subsequent notes — emit only
  // ========================================================================

  describe('subsequent notes emit', () => {
    it('should emit second note without adding another portamento CC', () => {
      const gb = createGlideBridge(false)

      let result = gb.withNote(6000, 480)
      result = result.withNote(6400, 480)

      const { notes, cc } = commitAndCapture(result)

      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)

      // Only one CC (portamento 127 from first note)
      expect(cc).toHaveLength(1)
      expect(cc[0].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[0].value).toBe(127)
    })

    it('should emit multiple subsequent notes without additional CC', () => {
      const gb = createGlideBridge(false)

      let result = gb.withNote(6000, 480)
      result = result.withNote(6400, 480)
      result = result.withNote(6700, 480)

      const { notes, cc } = commitAndCapture(result)

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(6000)
      expect(notes[1].pitch).toBe(6400)
      expect(notes[2].pitch).toBe(6700)

      expect(cc).toHaveLength(1)
      expect(cc[0].value).toBe(127)
    })
  })

  // ========================================================================
  // flush()
  // ========================================================================

  describe('flush()', () => {
    it('should send CC PORTAMENTO 0 when activated', () => {
      const gb = createGlideBridge(false)

      let result = gb.withNote(6000, 480)
      result = result.withNote(6400, 480)
      const flushed = (result as GlideBridge).flush()

      const { notes, cc } = commitAndCapture(flushed)

      expect(notes).toHaveLength(2)

      expect(cc).toHaveLength(2)
      expect(cc[0].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[0].value).toBe(127)
      expect(cc[1].controller).toBe(MIDI_CC.PORTAMENTO)
      expect(cc[1].value).toBe(0)
    })

    it('should not add CC when not activated (no notes yet)', () => {
      const gb = createGlideBridge(false)

      const flushed = (gb as GlideBridge).flush()
      const { cc } = commitAndCapture(flushed)

      expect(cc).toHaveLength(0)
    })
  })

  // ========================================================================
  // visitCC captures
  // ========================================================================

  describe('visitCC captures', () => {
    it('should capture all CC events in emission order', () => {
      const gb = createGlideBridge(false)

      let result = gb.withNote(6000, 480)
      result = result.withNote(6400, 480)
      const flushed = (result as GlideBridge).flush()

      const { cc } = commitAndCapture(flushed)

      expect(cc).toHaveLength(2)
      expect(cc[0]).toMatchObject({ controller: MIDI_CC.PORTAMENTO, value: 127 })
      expect(cc[1]).toMatchObject({ controller: MIDI_CC.PORTAMENTO, value: 0 })
      expect(cc[0]).toHaveProperty('tick')
      expect(cc[0]).toHaveProperty('sourceId')
    })
  })
})
