/**
 * TrillBuilder Test
 *
 * Tests trill() — rapid alternation between base and upper pitch:
 *   - Alternate base/upper from melody
 *   - rate, duration
 *   - Immutability
 */

import { describe, it, expect } from 'vitest'
import { trill } from '../../notations/melody'
import { TrillBuilder } from '../../builders/TrillBuilder'
import { createBridge, commitAndCapture } from '../test-utils'
import type { CompositionBridge } from '../../interfaces/composition-bridge'

describe('TrillBuilder', () => {

  describe('basic trill emission', () => {
    it('trill(upper, base) should alternate base then upper', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      // rate defaults to bridge.defaultDuration, duration defaults to bridge.defaultDuration
      // hitCount = floor(480/480) = 1 → only one note
      // We need duration > rate to get multiple hits
      const bridgeLong = createBridge({ defaultDuration: 480 })
      const result = trill('E4', 'C4').rate(120).duration(480).apply(bridgeLong)

      const { notes } = commitAndCapture(result)
      // hitCount = floor(480/120) = 4
      // i=0: base (C4=60), i=1: upper (E4=64), i=2: base, i=3: upper
      expect(notes).toHaveLength(4)
      expect(notes[0].pitch).toBe(60) // base
      expect(notes[1].pitch).toBe(64) // upper
      expect(notes[2].pitch).toBe(60) // base
      expect(notes[3].pitch).toBe(64) // upper
    })

    it('trill with numeric pitches should resolve correctly', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill(64, 60).rate(240).duration(480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(2) // floor(480/240)=2
      expect(notes[0].pitch).toBe(60)
      expect(notes[1].pitch).toBe(64)
    })

    it('trill with basePitch higher than pitch should still alternate', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      // base=C4 (60), upper=E4 (64) - base is lower
      const result = trill('E4', 'C4').rate(240).duration(480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(60) // base first (even i)
      expect(notes[1].pitch).toBe(64) // upper second (odd i)
    })
  })

  describe('rate and duration', () => {
    it('should use explicit rate and duration', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('F4', 'D4').rate(120).duration(360).apply(bridge)

      const { notes } = commitAndCapture(result)
      // hitCount = floor(360/120) = 3
      expect(notes).toHaveLength(3)
      expect(notes[0].duration).toBe(120)
    })

    it('should use bridge defaultDuration when rate/duration not provided', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('E4', 'C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      // hitCount = floor(480/480) = 1
      expect(notes).toHaveLength(1)
      expect(notes[0].duration).toBe(480)
    })
  })

  describe('modifiers', () => {
    it('.basePitch() should override base', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('E4', 'C4').basePitch('D4').rate(240).duration(480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(62) // D4
      expect(notes[1].pitch).toBe(64) // E4
    })

    it('.pitch() should override upper', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('E4', 'C4').pitch('F4').rate(240).duration(480).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes[0].pitch).toBe(60) // base C4
      expect(notes[1].pitch).toBe(65) // upper F4
    })
  })

  describe('edge cases', () => {
    it('trill with null pitch should emit nothing', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill(undefined, 'C4').apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })

    it('trill with null basePitch should emit nothing', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      const result = trill('E4', undefined).apply(bridge)

      const { notes } = commitAndCapture(result)
      expect(notes).toHaveLength(0)
    })
  })

  describe('immutability', () => {
    it('builder methods should return new instances, not mutate', () => {
      const original = trill('E4', 'C4')
      const withRate = original.rate(120)
      const withBase = original.basePitch('D4')

      const bridge = createBridge({ defaultDuration: 480 })
      const origResult = commitAndCapture(original.rate(240).duration(480).apply(bridge))
      const rateResult = commitAndCapture(withRate.duration(480).apply(bridge))
      const baseResult = commitAndCapture(withBase.rate(240).duration(480).apply(bridge))

      expect(rateResult.notes[0].duration).toBe(120)
      expect(baseResult.notes[0].pitch).toBe(62)
    })
  })

  describe('chaining with note', () => {
    it('trill then note should advance tick', () => {
      const bridge = createBridge({ defaultDuration: 480 })
      let b: CompositionBridge = bridge
      b = trill('E4', 'C4').rate(240).duration(480).apply(b)
      b = trill('G4', 'E4').rate(240).duration(240).apply(b)

      const { notes } = commitAndCapture(b)
      // First trill: rate 240, duration 480 → 2 notes; second: rate 240, duration 240 → 1 note
      expect(notes).toHaveLength(3) // 2 + 1
      expect(notes[2].tick).toBe(480)
    })
  })
})
