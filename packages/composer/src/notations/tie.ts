import { PipeStep, step } from '@symphonyscript/composer'
import { TieBridge } from '../composition/TieBridge'

export function tie(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    const tieBridge = new TieBridge(bridge)

    let current = tieBridge as TieBridge

    for (let i = 0; i < steps.length; ++i) {
      current = new TieBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
