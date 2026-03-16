import { PipeStep, step } from '@symphonyscript/composer'
import { HarmonizeBridge } from '../composition/HarmonizeBridge'

/**
 * Create a {@link PipeStep} that adds diatonic harmony voices above each emitted note.
 *
 * Wraps the bridge in {@link HarmonizeBridge}. For each note, resolves its scale degree
 * in the current key context, then emits additional notes at the specified diatonic
 * intervals above it. All harmony notes share the same tick and duration.
 *
 * Intervals are 1-based scale degrees (e.g. `3` = third, `5` = fifth). Notes not in
 * the current scale are passed through un-harmonized. In `precise` mode, harmonization
 * is bypassed entirely.
 *
 * Place as the first step in a pipe so subsequent steps emit through the HarmonizeBridge.
 *
 * @param intervals - Diatonic scale degrees to add above each note (e.g. 3, 5 for third + fifth)
 * @returns A {@link PipeStep} that wraps the bridge for harmonization
 *
 * @example
 * ```ts
 * harmonize(3, 5)                              // Add 3rd and 5th above each note
 * harmonize(3, 5, 8)                           // Third, fifth, octave
 * clip.pipe(harmonize(3, 5)).steps(note('C4')) // In C major: C4, E4, G4
 * harmonize()                                   // Empty intervals — no extra voices
 * ```
 */
export function harmonize(...intervals: number[]): PipeStep {
  return step((bridge) => new HarmonizeBridge(bridge, { intervals }))
}
