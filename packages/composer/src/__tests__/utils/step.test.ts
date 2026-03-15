/**
 * Tests the `step` utility which wraps an apply function into a PipeStep.
 *
 * Covers:
 *   - Returns object with `apply` property
 *   - `apply` when called with a bridge returns the result of the passed-in function
 */

import { describe, it, expect } from 'vitest'
import { step } from '../../utils/step'
import { createBridge } from '../test-utils'

describe('step', () => {

  it('returns object with apply property', () => {
    const fn = (b: ReturnType<typeof createBridge>) => b
    const result = step(fn)
    expect(result).toHaveProperty('apply')
    expect(typeof result.apply).toBe('function')
  })

  it('apply when called with a bridge returns the result of the passed-in function', () => {
    const bridge = createBridge({ velocity: 500 })
    const mutated = createBridge({ velocity: 900 })

    const fn = () => mutated
    const pipe = step(fn)
    const out = pipe.apply(bridge)

    expect(out).toBe(mutated)
  })

  it('apply passes the bridge to the inner function', () => {
    const bridge = createBridge({ velocity: 600 })
    const received: unknown[] = []

    const fn = (b: ReturnType<typeof createBridge>) => {
      received.push(b)
      return b
    }
    const pipe = step(fn)
    pipe.apply(bridge)

    expect(received).toHaveLength(1)
    expect(received[0]).toBe(bridge)
  })
})
