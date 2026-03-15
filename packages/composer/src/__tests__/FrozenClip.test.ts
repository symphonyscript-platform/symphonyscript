/**
 * Tests for FrozenClip.
 *
 * Covers:
 *   - constructor - stores notes, CC events, bend events
 *   - visitNotes - iterates over notes with callback
 *   - visitCC - iterates over CC events with callback
 *   - visitBends - iterates over bend events with callback
 *   - noteCount - returns notes length
 *   - duration - returns max tick from notes, CC, bends
 */

import { describe, it, expect } from 'vitest'
import { FrozenClip } from '../FrozenClip'
import type { RecordedNote, RecordedCC, RecordedBend } from '../interfaces/recorded-events'

describe('FrozenClip', () => {

  describe('constructor', () => {
    it('should accept notes, ccEvents, and bendEvents arrays', () => {
      const notes: RecordedNote[] = [
        { sourceId: 0, pitch: 60, velocity: 800, duration: 480, tick: 0, muted: false },
      ]
      const ccEvents: RecordedCC[] = []
      const bendEvents: RecordedBend[] = []

      const clip = new FrozenClip(notes, ccEvents, bendEvents)

      expect(clip.noteCount).toBe(1)
      expect(clip.duration).toBe(480)
    })

    it('should compute noteCount from notes length', () => {
      const notes: RecordedNote[] = [
        { sourceId: 0, pitch: 60, velocity: 800, duration: 100, tick: 0, muted: false },
        { sourceId: 1, pitch: 64, velocity: 800, duration: 100, tick: 100, muted: false },
        { sourceId: 2, pitch: 67, velocity: 800, duration: 100, tick: 200, muted: false },
      ]
      const clip = new FrozenClip(notes, [], [])

      expect(clip.noteCount).toBe(3)
    })

    it('should compute duration from max tick across notes', () => {
      const notes: RecordedNote[] = [
        { sourceId: 0, pitch: 60, velocity: 800, duration: 480, tick: 0, muted: false },
        { sourceId: 1, pitch: 64, velocity: 800, duration: 240, tick: 480, muted: false },
      ]
      const clip = new FrozenClip(notes, [], [])

      // Last note ends at 480 + 240 = 720
      expect(clip.duration).toBe(720)
    })

    it('should include CC tick in duration when CC is after last note', () => {
      const notes: RecordedNote[] = [
        { sourceId: 0, pitch: 60, velocity: 800, duration: 100, tick: 0, muted: false },
      ]
      const ccEvents: RecordedCC[] = [
        { sourceId: 0, controller: 7, value: 100, tick: 500 },
      ]
      const clip = new FrozenClip(notes, ccEvents, [])

      expect(clip.duration).toBe(500)
    })

    it('should include bend tick in duration when bend is after last note', () => {
      const notes: RecordedNote[] = [
        { sourceId: 0, pitch: 60, velocity: 800, duration: 100, tick: 0, muted: false },
      ]
      const bendEvents: RecordedBend[] = [
        { sourceId: 0, value: 0.5, tick: 600 },
      ]
      const clip = new FrozenClip(notes, [], bendEvents)

      expect(clip.duration).toBe(600)
    })

    it('should return 0 duration for empty clip', () => {
      const clip = new FrozenClip([], [], [])

      expect(clip.noteCount).toBe(0)
      expect(clip.duration).toBe(0)
    })
  })

  describe('visitNotes', () => {
    it('should invoke callback for each note with correct args', () => {
      const notes: RecordedNote[] = [
        { sourceId: 1, pitch: 60, velocity: 900, duration: 240, tick: 0, muted: false },
        { sourceId: 2, pitch: 64, velocity: 800, duration: 480, tick: 240, muted: true },
      ]
      const clip = new FrozenClip(notes, [], [])

      const visited: Array<{ sourceId: number; pitch: number; velocity: number; duration: number; tick: number; muted: boolean }> = []
      clip.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
        visited.push({ sourceId, pitch, velocity, duration, tick, muted })
      })

      expect(visited).toHaveLength(2)
      expect(visited[0]).toEqual({ sourceId: 1, pitch: 60, velocity: 900, duration: 240, tick: 0, muted: false })
      expect(visited[1]).toEqual({ sourceId: 2, pitch: 64, velocity: 800, duration: 480, tick: 240, muted: true })
    })

    it('should not invoke callback when no notes', () => {
      const clip = new FrozenClip([], [], [])
      let count = 0
      clip.visitNotes(() => { count++ })

      expect(count).toBe(0)
    })
  })

  describe('visitCC', () => {
    it('should invoke callback for each CC event with correct args', () => {
      const ccEvents: RecordedCC[] = [
        { sourceId: 1, controller: 7, value: 100, tick: 0 },
        { sourceId: 2, controller: 10, value: 64, tick: 480 },
      ]
      const clip = new FrozenClip([], ccEvents, [])

      const visited: Array<{ sourceId: number; controller: number; value: number; tick: number }> = []
      clip.visitCC((sourceId, controller, value, tick) => {
        visited.push({ sourceId, controller, value, tick })
      })

      expect(visited).toHaveLength(2)
      expect(visited[0]).toEqual({ sourceId: 1, controller: 7, value: 100, tick: 0 })
      expect(visited[1]).toEqual({ sourceId: 2, controller: 10, value: 64, tick: 480 })
    })

    it('should not invoke callback when no CC events', () => {
      const clip = new FrozenClip([], [], [])
      let count = 0
      clip.visitCC(() => { count++ })

      expect(count).toBe(0)
    })
  })

  describe('visitBends', () => {
    it('should invoke callback for each bend event with correct args', () => {
      const bendEvents: RecordedBend[] = [
        { sourceId: 1, value: 0.25, tick: 0 },
        { sourceId: 2, value: 0.5, tick: 240 },
      ]
      const clip = new FrozenClip([], [], bendEvents)

      const visited: Array<{ sourceId: number; value: number; tick: number }> = []
      clip.visitBends((sourceId, value, tick) => {
        visited.push({ sourceId, value, tick })
      })

      expect(visited).toHaveLength(2)
      expect(visited[0]).toEqual({ sourceId: 1, value: 0.25, tick: 0 })
      expect(visited[1]).toEqual({ sourceId: 2, value: 0.5, tick: 240 })
    })

    it('should not invoke callback when no bend events', () => {
      const clip = new FrozenClip([], [], [])
      let count = 0
      clip.visitBends(() => { count++ })

      expect(count).toBe(0)
    })
  })
})
