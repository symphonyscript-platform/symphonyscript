/**
 * Performance regression tests.
 *
 * Measures that composition of a 64-note clip (createBridge → compose → commitAndCapture)
 * completes within a reasonable threshold. Uses 100ms to tolerate CI variability.
 */

import { describe, it, expect } from 'vitest'
import { Clip } from '../Clip'
import { note } from '../notations/note'
import { loop } from '../notations/loop'
import { createBridge, commitAndCapture } from './test-utils'

describe('performance', () => {

  describe('64-note clip composition', () => {
    it('createBridge → compose → commitAndCapture should complete within 100ms', () => {
      const clip = Clip.pipe(loop(64, note('C4')))

      const start = performance.now()
      const bridge = createBridge({ defaultDuration: 480 })
      const result = clip.compose(bridge)
      commitAndCapture(result)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(100)
    })

    it('produces exactly 64 notes', () => {
      const clip = Clip.pipe(loop(64, note('C4')))
      const bridge = createBridge({ defaultDuration: 480 })
      const result = clip.compose(bridge)
      const { notes } = commitAndCapture(result)

      expect(notes).toHaveLength(64)
    })
  })
})
