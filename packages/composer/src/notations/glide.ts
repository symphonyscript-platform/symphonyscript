import { PipeStep, step } from '@symphonyscript/composer'
import { GlideBridge } from '../composition/GlideBridge'

export function glide(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    let current = new GlideBridge(bridge)

    for (let i = 0; i < steps.length; ++i) {
      current = new GlideBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
