/**
 * Articulation constants — duration and velocity multipliers
 * for expressive performance.
 */

function articulation(duration: number, velocity: number) {
  return Object.freeze({ duration, velocity })
}

/** Short, detached — half duration */
export const Staccato = articulation(0.5, 1.0)
/** Smooth, connected — slight overlap */
export const Legato   = articulation(1.05, 0.9)
/** Strong attack — increased velocity */
export const Accent   = articulation(1.0, 1.3)
/** Held for full value */
export const Tenuto   = articulation(1.0, 1.0)
/** Strong accent, slightly shorter */
export const Marcato  = articulation(0.75, 1.4)
