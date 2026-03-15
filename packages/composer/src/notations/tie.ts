import { PipeStep, step } from '@symphonyscript/composer'
import { TieBridge } from '../composition/TieBridge'

export function tie(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    let current = new TieBridge(bridge)

    for (let i = 0; i < steps.length; ++i) {
      current = new TieBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
