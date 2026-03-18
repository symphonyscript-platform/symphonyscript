/**
 * Tests for RFC-060: Continuous Pitch State on BaseCompositionBridge.
 */

import { describe, it, expect } from 'vitest'
import { createBridge } from '../test-utils'

describe('RFC-060: BaseCompositionBridge Continuous Pitch', () => {
  describe('defaults', () => {
    const b = createBridge()

    it('scaleRootCents defaults to 0', () => {
      expect(b.scaleRootCents).toBe(0)
    })

    it('keyRootCents defaults to null', () => {
      expect(b.keyRootCents).toBeNull()
    })

    it('scaleIntervals defaults to notation/ionian when not set', () => {
      expect(b.scaleIntervals).not.toBeNull()
      expect(Array.isArray(b.scaleIntervals)).toBe(true)
    })

    it('temperament defaults to null', () => {
      expect(b.temperament).toBeNull()
    })

    it('tuningHz defaults to 440', () => {
      expect(b.tuningHz).toBe(440)
    })

    it('transposeCents defaults to 0', () => {
      expect(b.transposeCents).toBe(0)
    })
  })

  describe('constructor params', () => {
    it('accepts all continuous fields in constructor', () => {
      const intervals = [0, 200, 400, 500, 700, 900, 1100]
      const temperament = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100]

      const b = createBridge({
        scaleRootCents: 4800,
        keyRootCents: 5700,
        scaleIntervals: intervals,
        temperament: temperament,
        tuningHz: 432,
        transposeCents: 700,
      })

      expect(b.scaleRootCents).toBe(4800)
      expect(b.keyRootCents).toBe(5700)
      expect(b.scaleIntervals).toBe(intervals)
      expect(b.temperament).toBe(temperament)
      expect(b.tuningHz).toBe(432)
      expect(b.transposeCents).toBe(700)
    })
  })

  describe('with* setters', () => {
    const base = createBridge()

    it('withScaleRootCents returns new bridge with updated value', () => {
      const b = base.withScaleRootCents(4800)
      expect(b.scaleRootCents).toBe(4800)
      expect(base.scaleRootCents).toBe(0) // original unchanged
    })

    it('withKeyRootCents returns new bridge with updated value', () => {
      const b = base.withKeyRootCents(5700)
      expect(b.keyRootCents).toBe(5700)
      expect(base.keyRootCents).toBeNull()
    })

    it('withKeyRootCents(null) clears the value', () => {
      const b = base.withKeyRootCents(5700).withKeyRootCents(null)
      expect(b.keyRootCents).toBeNull()
    })

    it('withScaleIntervals returns new bridge with updated value', () => {
      const intervals = [0, 200, 400, 500, 700, 900, 1100]
      const b = base.withScaleIntervals(intervals)
      expect(b.scaleIntervals).toBe(intervals)
      expect(base.scaleIntervals).not.toBeNull()
    })

    it('withTemperament returns new bridge with updated value', () => {
      const t = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100]
      const b = base.withTemperament(t)
      expect(b.temperament).toBe(t)
      expect(base.temperament).toBeNull()
    })

    it('withTuningHz returns new bridge with updated value', () => {
      const b = base.withTuningHz(432)
      expect(b.tuningHz).toBe(432)
      expect(base.tuningHz).toBe(440)
    })

    it('withTransposeCents returns new bridge with updated value', () => {
      const b = base.withTransposeCents(700)
      expect(b.transposeCents).toBe(700)
      expect(base.transposeCents).toBe(0)
    })
  })

  describe('chaining', () => {
    it('preserves all continuous fields through chaining', () => {
      const intervals = [0, 200, 400, 500, 700, 900, 1100]
      const t = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100]

      const b = createBridge()
        .withScaleRootCents(4800)
        .withKeyRootCents(5700)
        .withScaleIntervals(intervals)
        .withTemperament(t)
        .withTuningHz(432)
        .withTransposeCents(700)

      expect(b.scaleRootCents).toBe(4800)
      expect(b.keyRootCents).toBe(5700)
      expect(b.scaleIntervals).toBe(intervals)
      expect(b.temperament).toBe(t)
      expect(b.tuningHz).toBe(432)
      expect(b.transposeCents).toBe(700)
    })

    it('continuous fields survive withNote chaining', () => {
      const b = createBridge()
        .withTuningHz(432)
        .withTransposeCents(700)
        .withNote(6000, 480)

      expect(b.tuningHz).toBe(432)
      expect(b.transposeCents).toBe(700)
    })
  })

  describe('non-regression', () => {
    it('existing fields are unaffected by continuous fields', () => {
      const b = createBridge({ velocity: 500 })
        .withScaleRootCents(4800)
        .withTransposeCents(700)

      expect(b.velocity).toBe(500)
      expect(b.scaleRootCents).toBe(4800)
      expect(b.transposeCents).toBe(700)
    })
  })
})
