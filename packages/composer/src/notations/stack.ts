import { PipeStep, step } from '@symphonyscript/composer'

export function stack(...branches: PipeStep[][]): PipeStep {
  return step((bridge) => {
    const startTick = bridge.tick
    let maxTick = startTick
    let current = bridge

    for (let i = 0; i < branches.length; ++i) {
      const branch = branches[i]

      // Fork: reset tick to start for each branch
      let branchBridge = current.withTick(startTick)

      for (let j = 0; j < branch.length; ++j) {
        branchBridge = branch[j].apply(branchBridge)
      }

      // Track the furthest tick reached
      if (branchBridge.tick > maxTick) {
        maxTick = branchBridge.tick
      }

      current = branchBridge
    }

    // Advance to the longest branch's end tick
    return current.withTick(maxTick)
  })
}
