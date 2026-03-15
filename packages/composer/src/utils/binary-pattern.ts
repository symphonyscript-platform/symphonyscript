import type { CompositionBridge } from '@symphonyscript/composer'

/**
 * Apply a binary step pattern to a bridge, emitting notes on hits and advancing tick on rests.
 * Cycles through the pitches array on each hit.
 *
 * @param pattern  - Array of 0/1 (or truthy/falsy) values
 * @param pitches  - Array of MIDI pitches to cycle through on hits
 * @param duration - Duration per step in ticks
 * @param bridge   - Starting bridge state
 * @param velocity - Optional fixed velocity
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
