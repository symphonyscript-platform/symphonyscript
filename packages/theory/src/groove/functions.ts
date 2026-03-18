/**
 * Groove application functions.
 */

import type { GrooveTemplate, GrooveStep } from './types'

/**
 * Create an MPC-style swing groove.
 *
 * @param amount - Swing amount: 0.5 (straight) to 0.75 (dotted)
 * @param stepsPerBeat - Grid resolution (default 4 = 16th notes)
 * @returns GrooveTemplate with swing applied
 */
export function createSwing(amount: number, stepsPerBeat: number = 4): GrooveTemplate {
  const delay = (amount - 0.5) * 2
  const steps: GrooveStep[] = new Array(stepsPerBeat)

  for (let i = 0; i < stepsPerBeat; ++i) {
    steps[i] = i % 2 !== 0 ? { timing: delay } : {}
  }

  return Object.freeze({
    name: `MPC Swing ${Math.round(amount * 100)}%`,
    stepsPerBeat,
    steps: Object.freeze(steps),
  })
}

/**
 * Get groove timing offset for a step.
 *
 * @param step - Step index in the pattern
 * @param template - Groove template
 * @returns Timing offset (-1.0 to 1.0)
 */
export function getGrooveTiming(step: number, template: GrooveTemplate): number {
  if (template.steps.length === 0) return 0
  const idx = step % template.steps.length
  return template.steps[idx]?.timing ?? 0
}

/**
 * Get groove velocity multiplier for a step.
 *
 * @param step - Step index in the pattern
 * @param template - Groove template
 * @param baseVelocity - Base velocity multiplier (default 1.0)
 * @returns Velocity multiplier
 */
export function getGrooveVelocity(
  step: number,
  template: GrooveTemplate,
  baseVelocity: number = 1.0,
): number {
  if (template.steps.length === 0) return baseVelocity
  const idx = step % template.steps.length
  return baseVelocity * (template.steps[idx]?.velocity ?? 1.0)
}

/**
 * Get groove duration multiplier for a step.
 *
 * @param step - Step index in the pattern
 * @param template - Groove template
 * @param baseDuration - Base duration multiplier (default 1.0)
 * @returns Duration multiplier
 */
export function getGrooveDuration(
  step: number,
  template: GrooveTemplate,
  baseDuration: number = 1.0,
): number {
  if (template.steps.length === 0) return baseDuration
  const idx = step % template.steps.length
  return baseDuration * (template.steps[idx]?.duration ?? 1.0)
}
