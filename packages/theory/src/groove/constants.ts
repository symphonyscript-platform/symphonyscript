/**
 * Pre-defined groove templates.
 */

import type { GrooveTemplate, GrooveStep } from './types'

function groove(name: string, stepsPerBeat: number, steps: GrooveStep[]): GrooveTemplate {
  return Object.freeze({ name, stepsPerBeat, steps: Object.freeze(steps) })
}

/** Straight timing (no groove) */
export const Straight = groove('Straight', 4, [])

/** Classic MPC 55% Swing (16th notes) */
export const Mpc16_55 = groove('MPC Swing 55%', 4, [
  {}, { timing: 0.1 }, {}, { timing: 0.1 },
])

/** Classic MPC 57% Swing (16th notes) */
export const Mpc16_57 = groove('MPC Swing 57%', 4, [
  {}, { timing: 0.14 }, {}, { timing: 0.14 },
])

/** Classic MPC 60% Swing (16th notes) */
export const Mpc16_60 = groove('MPC Swing 60%', 4, [
  {}, { timing: 0.2 }, {}, { timing: 0.2 },
])

/** Classic MPC 66% Triplet Swing (16th notes) */
export const Mpc16_66 = groove('MPC Swing 66%', 4, [
  {}, { timing: 0.32 }, {}, { timing: 0.32 },
])

/** Hard Swing (dotted 16th feel) */
export const Mpc16_75 = groove('MPC Swing 75%', 4, [
  {}, { timing: 0.5 }, {}, { timing: 0.5 },
])

/** Basic Swing (approx 66% ratio, triplet feel) */
export const Swing = groove('Swing', 2, [
  { timing: 0 }, { timing: 0.16 },
])

/** Delayed backbeat feel — relaxed vibe */
export const LaidBack = groove('Laid Back', 1, [
  { timing: 0, velocity: 1.0 },
  { timing: 0.02, velocity: 0.9 },
  { timing: 0.05, velocity: 1.1 },
  { timing: 0.02, velocity: 0.9 },
])

/** Rushing feel — creates urgency */
export const Rushing = groove('Rushing', 1, [
  { timing: 0, velocity: 1.0 },
  { timing: -0.01, velocity: 1.0 },
  { timing: -0.02, velocity: 1.0 },
  { timing: -0.01, velocity: 1.0 },
])
