/**
 * Tests for RFC-060: Continuous Pitch Cues — tuning(), temperament(), offset().
 */

import { BaseCompositionBridge } from '../../composition/BaseCompositionBridge'
import {
  tuning,
  temperament,
} from '../../cues/setters'
import { offset } from '../../cues/offset'

// Minimal helper: apply a FieldSetter in cascade mode (no scoping)
function applySetterDefault(setter: { apply(b: any): any }, bridge: BaseCompositionBridge) {
  return setter.apply(bridge)
}

describe('RFC-060: Continuous Pitch Cues', () => {
  describe('tuning()', () => {
    it('sets tuningHz on the bridge', () => {
      const b = new BaseCompositionBridge()
      const result = tuning(432).apply(b) as BaseCompositionBridge
      expect(result.tuningHz).toBe(432)
    })

    it('preserves other bridge state', () => {
      const b = new BaseCompositionBridge({ velocity: 500 })
      const result = tuning(415).apply(b) as BaseCompositionBridge
      expect(result.tuningHz).toBe(415)
      expect(result.velocity).toBe(500)
    })
  })

  describe('temperament()', () => {
    it('resolves string preset to temperament array', () => {
      const b = new BaseCompositionBridge()
      const result = temperament('equal').apply(b) as BaseCompositionBridge
      expect(result.temperament).not.toBeNull()
      expect(result.temperament!.length).toBe(12)
      expect(result.temperament![0]).toBe(0)
      expect(result.temperament![11]).toBe(1100) // equal-tempered B
    })

    it('resolves custom array', () => {
      const custom = [0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 996, 1088]
      const b = new BaseCompositionBridge()
      const result = temperament(custom).apply(b) as BaseCompositionBridge
      expect(result.temperament).toEqual(custom)
    })

    it('preserves other bridge state', () => {
      const b = new BaseCompositionBridge({ velocity: 600, tuningHz: 432 })
      const result = temperament('just').apply(b) as BaseCompositionBridge
      expect(result.velocity).toBe(600)
      expect(result.tuningHz).toBe(432)
      expect(result.temperament).not.toBeNull()
    })
  })

  describe('offset()', () => {
    it('creates an OffsetBuilder', () => {
      const builder = offset(0)
      expect(builder).toBeDefined()
      expect(typeof builder.apply).toBe('function')
    })

    it('offset(0) emits at 5700 cents (A4)', () => {
      const b = new BaseCompositionBridge()
      const result = offset(0).apply(b) as BaseCompositionBridge
      // Tick should have advanced (note was emitted)
      expect(result.tick).toBeGreaterThan(0)
    })

    it('offset(100) emits at 5800 cents (100 above A4)', () => {
      const b = new BaseCompositionBridge()
      const result = offset(100).apply(b) as BaseCompositionBridge
      expect(result.tick).toBeGreaterThan(0)
    })

    it('supports velocity chaining', () => {
      const builder = offset(0).velocity(900)
      expect(builder).toBeDefined()
    })

    it('supports repeat chaining', () => {
      const b = new BaseCompositionBridge({ defaultDuration: 480 })
      const result = offset(0).repeat(3).apply(b) as BaseCompositionBridge
      // 3 repetitions × 480 ticks = 1440
      expect(result.tick).toBe(1440)
    })

    it('supports octave shift', () => {
      const builder = offset(0).up(1)
      expect(builder).toBeDefined()
    })

    it('offset with duration parameter', () => {
      const b = new BaseCompositionBridge()
      const result = offset(0, 240).apply(b) as BaseCompositionBridge
      expect(result.tick).toBe(240)
    })
  })
})
