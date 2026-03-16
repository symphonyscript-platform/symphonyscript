import { PipeStep, step } from '@symphonyscript/composer'
import { TieBridge } from '../composition/TieBridge'

/**
 * Create a {@link PipeStep} that merges consecutive same-pitch notes across multiple steps.
 *
 * Runs each step through {@link TieBridge}, so notes from different steps that share
 * the same pitch are merged into a single sustained note. The accumulated duration
 * is emitted when a different pitch arrives or when the last step finishes (flush).
 *
 * Use for legato phrases where repeated notes should sound as one held note rather
 * than separate attacks.
 *
 * @param steps - One or more {@link PipeStep}s whose output is fed through the tie logic
 * @returns A {@link PipeStep} that applies the given steps with tie merging
 *
 * @example
 * ```ts
 * tie(note('C4'), note('C4'), note('E4'))           // C4 tied (2× duration), then E4
 * tie(note('C4', 240), note('C4', 240), note('G4'))  // C4 at 480 ticks, G4 at default
 * clip.steps(tie(note('C4'), note('C4')), rest(480)) // Tie within a clip
 * ```
 */
export function tie(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    let current = new TieBridge(bridge)

    for (let i = 0; i < steps.length; ++i) {
      current = new TieBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
