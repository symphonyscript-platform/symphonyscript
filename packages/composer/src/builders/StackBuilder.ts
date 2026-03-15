import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'
import {
  type ScopeEntry,
  appendStepsEntry,
  appendClipEntry,
} from '../utils/scope-entries'

/**
 * Builder for parallel composition.
 *
 * Each `.steps()` / `.use()` call adds a branch.
 * All branches fork from the same tick and run independently.
 * After all branches, tick advances to the longest branch's end.
 *
 * Usage:
 *   stack()
 *     .steps(note('C4'), note('E4'))
 *     .use(drumClip)
 *     .steps(chord('Am'), chord('F'))
 */
export class StackBuilder implements PipeStep {
  private readonly branches: ScopeEntry[]

  constructor(branches: ScopeEntry[] = []) {
    this.branches = branches
  }

  /** Add a branch of inline steps. */
  steps(...pipeSteps: PipeStep[]): StackBuilder {
    return new StackBuilder(appendStepsEntry(this.branches, pipeSteps))
  }

  /** Add a clip as a branch. */
  use(clip: Composable): StackBuilder {
    return new StackBuilder(appendClipEntry(this.branches, clip))
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const startTick = bridge.tick
    let maxTick = startTick
    let result = bridge

    for (let i = 0; i < this.branches.length; ++i) {
      const branch = this.branches[i]

      // Fork: reset tick to start for each branch, always from original bridge
      let branchBridge = result.withTick(startTick)

      if (branch.kind === 'steps') {
        for (let j = 0; j < branch.steps.length; ++j) {
          branchBridge = branch.steps[j].apply(branchBridge)
        }
      } else {
        branchBridge = branch.clip.compose(branchBridge)
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
