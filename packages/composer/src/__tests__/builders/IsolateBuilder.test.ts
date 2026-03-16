/**
 * Exemplar: IsolateBuilder Test
 *
 * Tests IsolateBuilder (returned by `isolate()`).
 * IsolateBuilder is a structural composition primitive that isolates state changes.
 *
 * Covers:
 *   - Full state isolation (velocity, transpose, tempo don't leak)
 *   - Tick DOES propagate (notes emitted are preserved)
 *   - Thunks (emitted notes) propagate through isolation
 *   - Volume/pan restore emits CC events
 *   - Key context restore (including null → null)
 *   - Empty isolation is a no-op
 */

import { describe, it, expect } from 'vitest'
import { note } from '../../cues/note'
import { isolate } from '../../cues/isolate'
import { velocity, transpose, tempo, volume } from '../../cues/setters'
import { createBridge, commitAndCapture } from '../test-utils'
import { MIDI_CC } from '@symphonyscript/theory'

describe('IsolateBuilder', () => {

  // ========================================================================
  // State isolation
  // ========================================================================

  describe('state isolation', () => {
    it('should isolate velocity changes', () => {
      const bridge = createBridge({ velocity: 800, defaultDuration: 480 })

      const result = isolate()
        .steps(velocity(400), note('C4'))
        .apply(bridge)

      expect(result.velocity).toBe(800) // restored
    })

    it('should isolate transpose changes', () => {
      const bridge = createBridge({ transpose: 0, defaultDuration: 480 })

      let b = isolate()
        .steps(transpose(12), note('C4'))
        .apply(bridge)

      // Transpose should be restored to 0
      expect(b.transpose).toBe(0)

      // Next note should not be transposed
      b = note('E4').apply(b)
      const { notes } = commitAndCapture(b)
      expect(notes[0].pitch).toBe(72) // C4 + 12 (inside isolate)
      expect(notes[1].pitch).toBe(64) // E4 (after isolate, no transpose)
    })

    it('should isolate tempo changes', () => {
      const bridge = createBridge({ tempo: 120, defaultDuration: 480 })

      const result = isolate()
        .steps(tempo(200), note('C4'))
        .apply(bridge)

      expect(result.tempo).toBe(120) // restored
    })

    it('should isolate volume changes and emit restore CC', () => {
      const bridge = createBridge({ volume: 100, defaultDuration: 480 })

      const result = isolate()
        .steps(volume(30), note('C4'))
        .apply(bridge)

      expect(result.volume).toBe(100) // restored

      const { cc } = commitAndCapture(result)
      const volumeCC = cc.filter(e => e.controller === MIDI_CC.VOLUME)
      // Should have at least 2 CC events: set to 30, restore to 100
      expect(volumeCC.length).toBeGreaterThanOrEqual(2)
      expect(volumeCC[0].value).toBe(30)
      expect(volumeCC[volumeCC.length - 1].value).toBe(100)
    })

    it('should isolate multiple state changes simultaneously', () => {
      const bridge = createBridge({
        velocity: 800,
        transpose: 0,
        tempo: 120,
        defaultDuration: 480,
      })

      const result = isolate()
        .steps(
          velocity(400),
          transpose(7),
          tempo(180),
          note('C4'),
        )
        .apply(bridge)

      expect(result.velocity).toBe(800)
      expect(result.transpose).toBe(0)
      expect(result.tempo).toBe(120)
    })
  })

  // ========================================================================
  // Tick propagation
  // ========================================================================

  describe('tick propagation', () => {
    it('tick should advance through isolated steps', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = isolate()
        .steps(note('C4'), note('E4'), note('G4'))
        .apply(bridge)

      expect(result.tick).toBe(1440) // 3 × 480
    })

    it('emitted notes should be preserved through isolation', () => {
      const bridge = createBridge({ defaultDuration: 480 })

      const result = isolate()
        .steps(note('C4'), note('E4'))
        .apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2)
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
    })
  })

  // ========================================================================
  // Key context isolation
  // ========================================================================

  describe('key context isolation', () => {
    it('should not restore key context if parent had none', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      // keyRoot defaults to null

      const result = isolate()
        .steps(note('C4'))
        .apply(bridge)

      expect(result.keyRoot).toBeNull()
    })
  })

  // ========================================================================
  // Empty isolation
  // ========================================================================

  describe('edge cases', () => {
    it('empty isolate should be a no-op', () => {
      const bridge = createBridge({ velocity: 800 })
      const result = isolate().apply(bridge)

      expect(result.tick).toBe(bridge.tick)
      expect(result.velocity).toBe(bridge.velocity)
    })

    it('isolate().steps() with no args should be a no-op', () => {
      const bridge = createBridge({ velocity: 800 })
      const result = isolate().steps().apply(bridge)

      // still works (empty steps array)
      expect(result.tick).toBe(bridge.tick)
    })
  })
})
