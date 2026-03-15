import { CompositionBridge, PipeStep, step } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'

/**
 * Emit a chord built from scale degrees.
 * Resolves degrees to pitches using the bridge's scale context.
 *
 * @param degrees - Array of scale degree numbers (1-indexed)
 * @param duration - Optional duration for all notes
 */
export function degreeChord(degrees: number[], duration?: number): PipeStep {
  return step((bridge) => {
    const scaleMode = bridge.scaleMode as ScaleMode
    const startTick = bridge.tick
    const resolvedDuration = duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < degrees.length; ++i) {
      const pitch = degreeToPitch(
        degrees[i],
        bridge.scaleRoot,
        scaleMode,
        4,
      )

      if (pitch === null) continue

      target = target
        .withTick(startTick)
        .withNote(pitch, resolvedDuration, undefined)
    }

    target = target.withTick(startTick + resolvedDuration)

    return target
  })
}
