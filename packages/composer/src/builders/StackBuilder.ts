import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'

/**
 * Immutable builder for parallel composition — stacks multiple entries vertically
 * as parallel voices or layers.
 *
 * **Stacking semantics:** All branches fork from the same tick and run independently.
 * Each branch receives a copy of the bridge with `tick` reset to the start; steps within
 * a branch advance that branch's tick sequentially. After all branches complete, the
 * output tick advances to the longest branch's end (maximum tick reached across branches).
 *
 * Use this for polyphonic parts, layered textures, or concurrent clips that begin
 * simultaneously. Contrast with {@link ScopedBuilder}, which applies steps sequentially.
 *
 * @example
 * ```ts
 * stack()
 *   .branch(note('C4'), note('E4'))        // Voice 1: melody
 *   .branch(use(drumClip))                  // Voice 2: drums
 *   .branch(chord('Am'), chord('F'))        // Voice 3: harmony
 * stack([note('C4'), note('E4')], [kick(), snare()])  // Shorthand via stack()
 * stack([note('C4')], [note('E4')], [note('G4')])    // Three notes at tick 0
 * ```
 */
export class StackBuilder implements PipeStep {
  /** Array of branch groups. Each branch is a `PipeStep[]` run in sequence. */
  private readonly branches: PipeStep[][]

  constructor(branches: PipeStep[][] = []) {
    this.branches = branches
  }

  /**
   * Add a parallel branch. Each branch starts at the same tick as all others.
   *
   * @param pipeSteps - Steps to run in sequence within this branch (notes, chords, clips, etc.)
   * @returns New StackBuilder with the appended branch (immutable)
   */
  branch(...pipeSteps: PipeStep[]): StackBuilder {
    return new StackBuilder(appendSteps(this.branches, pipeSteps))
  }

  /**
   * Fork each branch from the start tick, run them in order, and advance to the longest.
   *
   * For each branch: resets the bridge tick to `bridge.tick`, applies each step in
   * sequence (updating that branch's tick), then records the branch end tick. The
   * final output tick is the maximum across all branches. Later branches receive
   * the accumulated bridge state from the previous branch (notes/CCs merge).
   *
   * @param bridge - Current composition state (tick, velocity, notes, etc.)
   * @returns Updated bridge with all branch output merged; tick at longest branch end
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const startTick = bridge.tick
    let maxTick = startTick
    let result = bridge

    for (let i = 0; i < this.branches.length; ++i) {
      const steps = this.branches[i]

      // Fork: reset tick to start for each branch, always from original bridge
      let branchBridge = result.withTick(startTick)

      for (let j = 0; j < steps.length; ++j) {
        branchBridge = steps[j].apply(branchBridge)
      }

      // Track the furthest tick reached
      if (branchBridge.tick > maxTick) {
        maxTick = branchBridge.tick
      }

      result = branchBridge
    }

    // Advance to the longest branch's end tick
    return result.withTick(maxTick)
  }
}
