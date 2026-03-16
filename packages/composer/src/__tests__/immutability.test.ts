/**
 * Deep immutability tests — verify no shared mutable state between builder variants.
 *
 * Pattern: apply original → apply withX (might share state) → re-apply original.
 * Verify original still produces SAME result. Proves no shared mutable state.
 *
 * Covers: EuclideanBuilder, TremoloBuilder, SwingBuilder, QuantizationBuilder.
 */

import { describe, it, expect } from 'vitest'
import { euclidean } from '../cues/euclidean'
import { tremolo } from '../cues/melody'
import { swing } from '../cues/swing'
import { quantize } from '../cues/quantize'
import { note } from '../cues/note'
import { createBridge, commitAndCapture } from './test-utils'

describe('deep immutability', () => {

  describe('EuclideanBuilder', () => {
    it('original produces same result after applying modified variant', () => {
      const base = euclidean(3, 8).notes(['C4'])
      const withStepDur = base.stepDuration(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      // Apply withStepDur (might share state)
      commitAndCapture(withStepDur.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))

      expect(r1.notes).toEqual(r2.notes)
    })

    it('original unchanged after applying velocity-modified variant', () => {
      const base = euclidean(3, 8).notes(['C4'])
      const withVel = base.velocity(500)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      commitAndCapture(withVel.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))
      expect(r1.notes).toEqual(r2.notes)
    })
  })

  describe('TremoloBuilder', () => {
    it('original produces same result after applying modified variant', () => {
      const base = tremolo('C4', 120, 480)
      const withPitch = base.pitch('E4')
      const withRate = base.rate(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      // Apply variants (might share state)
      commitAndCapture(withPitch.apply(createBridge({ defaultDuration: 480 })))
      commitAndCapture(withRate.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))
      expect(r1.notes).toEqual(r2.notes)
    })

    it('original unchanged after applying duration-modified variant', () => {
      const base = tremolo('C4', 120, 480)
      const withDuration = base.duration(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      commitAndCapture(withDuration.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))
      expect(r1.notes).toEqual(r2.notes)
    })
  })

  describe('SwingBuilder', () => {
    it('original produces same result after applying modified variant', () => {
      const base = swing(0.5).steps(note('C4'), note('C4'))
      const withAmount = base.amount(0)
      const withGrid = base.grid(240)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      commitAndCapture(withAmount.apply(createBridge({ defaultDuration: 480 })))
      commitAndCapture(withGrid.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))
      expect(r1.notes).toEqual(r2.notes)
    })
  })

  describe('QuantizationBuilder', () => {
    it('original produces same result after applying modified variant', () => {
      const base = quantize(480, 1).steps(
        note('C4').duration(240),
        note('C4').duration(480),
      )
      const withGrid = base.grid(240)
      const withStrength = base.strength(0)

      const bridge = createBridge({ defaultDuration: 480 })
      const r1 = commitAndCapture(base.apply(bridge))

      commitAndCapture(withGrid.apply(createBridge({ defaultDuration: 480 })))
      commitAndCapture(withStrength.apply(createBridge({ defaultDuration: 480 })))

      const r2 = commitAndCapture(base.apply(createBridge({ defaultDuration: 480 })))
      expect(r1.notes).toEqual(r2.notes)
    })
  })
})
