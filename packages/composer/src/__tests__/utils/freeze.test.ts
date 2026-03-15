/**
 * Tests for the `freeze` utility.
 *
 * freeze(composer: IClip): IFrozenClip creates a BaseCompositionBridge,
 * runs composer.compose(bridge), commits to RecordingBridge, returns
 * recorder.toFrozenClip(). Integration-style: uses a real IClip (Clip.pipe
 * with note()) that produces notes.
 */

import { describe, it, expect } from 'vitest'
import { freeze } from '../../utils/freeze'
import { Clip } from '../../Clip'
import { note } from '../../notations/note'

describe('freeze', () => {

  describe('return type', () => {
    it('returns IFrozenClip with required shape', () => {
      const clip = Clip.pipe(note('C4'))
      const frozen = freeze(clip)

      expect(frozen).toBeDefined()
      expect(typeof frozen.noteCount).toBe('number')
      expect(typeof frozen.duration).toBe('number')
      expect(typeof frozen.visitNotes).toBe('function')
      expect(typeof frozen.visitCC).toBe('function')
      expect(typeof frozen.visitBends).toBe('function')
    })
  })

  describe('note visitation', () => {
    it('can visit notes from frozen single-note clip', () => {
      const clip = Clip.pipe(note('C4'))
      const frozen = freeze(clip)

      const notes: Array<{ sourceId: number; pitch: number; velocity: number; duration: number; tick: number; muted: boolean }> = []
      frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
        notes.push({ sourceId, pitch, velocity, duration, tick, muted })
      })

      expect(notes).toHaveLength(1)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[0].tick).toBe(0)
      expect(frozen.noteCount).toBe(1)
    })

    it('can visit notes from frozen multi-note clip', () => {
      const clip = Clip.pipe(note('C4'), note('E4'), note('G4'))
      const frozen = freeze(clip)

      const notes: Array<{ sourceId: number; pitch: number; velocity: number; duration: number; tick: number; muted: boolean }> = []
      frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
        notes.push({ sourceId, pitch, velocity, duration, tick, muted })
      })

      expect(notes).toHaveLength(3)
      expect(notes[0].pitch).toBe(60) // C4
      expect(notes[1].pitch).toBe(64) // E4
      expect(notes[2].pitch).toBe(67) // G4
      expect(notes[0].tick).toBe(0)
      expect(notes[1].tick).toBe(1) // defaultDuration=1, each note advances tick
      expect(notes[2].tick).toBe(2)
      expect(frozen.noteCount).toBe(3)
    })

    it('frozen clip reflects duration from composed notes', () => {
      const clip = Clip.pipe(note('C4'), note('E4')) // 2 notes, defaultDuration=1 each
      const frozen = freeze(clip)

      expect(frozen.duration).toBe(2) // 2 notes × defaultDuration 1 = end at tick 2
    })

    it('visitCC and visitBends can be called without error', () => {
      const clip = Clip.pipe(note('C4'))
      const frozen = freeze(clip)

      const cc: Array<{ sourceId: number; controller: number; value: number; tick: number }> = []
      frozen.visitCC((sourceId, controller, value, tick) => {
        cc.push({ sourceId, controller, value, tick })
      })

      const bends: Array<{ sourceId: number; value: number; tick: number }> = []
      frozen.visitBends((sourceId, value, tick) => {
        bends.push({ sourceId, value, tick })
      })

      // No notes emit CC/bends by default, so collections may be empty
      expect(Array.isArray(cc)).toBe(true)
      expect(Array.isArray(bends)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('empty clip produces frozen clip with zero notes', () => {
      const clip = Clip.pipe()
      const frozen = freeze(clip)

      const notes: Array<{ pitch: number }> = []
      frozen.visitNotes((_, pitch) => notes.push({ pitch }))

      expect(frozen.noteCount).toBe(0)
      expect(notes).toHaveLength(0)
      expect(frozen.duration).toBe(0)
    })
  })
})
