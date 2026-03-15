import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'

/**
 * Builder for parallel composition.
 *
 * Each `.branch()` call adds a parallel branch.
 * All branches fork from the same tick and run independently.
 * After all branches, tick advances to the longest branch's end.
 *
 * Usage:
 *   stack()
 *     .branch(note('C4'), note('E4'))
 *     .branch(use(drumClip))
 *     .branch(chord('Am'), chord('F'))
 */
export class StackBuilder implements PipeStep {
  private readonly branches: PipeStep[][]

  constructor(branches: PipeStep[][] = []) {
    this.branches = branches
  }

  /** Add a parallel branch. */
  branch(...pipeSteps: PipeStep[]): StackBuilder {
    return new StackBuilder(appendSteps(this.branches, pipeSteps))
  }

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
