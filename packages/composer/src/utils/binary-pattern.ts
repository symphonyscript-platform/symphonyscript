import type { CompositionBridge } from '@symphonyscript/composer'

/**
 * Apply a binary step pattern to a bridge, emitting notes on hits and advancing tick on rests.
 * Cycles through the pitches array on each hit.
 *
 * For each pattern step: a truthy value (e.g. `1`, `true`) emits a note using the next pitch
 * in the cycle and advances tick by `duration`; a falsy value (e.g. `0`, `false`) advances tick
 * only, producing a rest.
 *
 * @param pattern  - Array of 0/1 or truthy/falsy values (1 = hit, 0 = rest)
 * @param pitches  - Array of pitches (in cents) to cycle through on hits
 * @param duration - Duration per step in ticks
 * @param bridge   - Starting bridge state
 * @param velocity - Fixed velocity for emitted notes. When omitted, uses the bridge's current
 *                   default velocity (e.g. from `withVelocity` or bridge config).
 * @returns The resulting {@link CompositionBridge} (uncommitted)
 * @example
 * // Pattern [1,0,1,0] with [60,64]: emits C4 and E4 on hits, rests on gaps
 * const result = applyBinaryPattern([1, 0, 1, 0], [60, 64], 480, bridge)
 *
 * @example
 * // With explicit velocity override
 * applyBinaryPattern([1, 1], [60], 240, bridge, 100)
 */
export function applyBinaryPattern(
  pattern: (number | boolean)[],
  pitches: number[],
  duration: number,
  bridge: CompositionBridge,
  velocity?: number,
): CompositionBridge {
  let target = bridge
  let noteIndex = 0

  for (let i = 0; i < pattern.length; ++i) {
    if (pattern[i]) {
      target = target.withNote(
        pitches[noteIndex % pitches.length],
        duration,
        velocity,
      )
      ++noteIndex
    } else {
      target = target.withTick(target.tick + duration)
    }
  }

  return target
}
