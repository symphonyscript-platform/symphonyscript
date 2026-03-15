import { PipeStep, step } from '@symphonyscript/composer'
import { GlideBridge } from '../composition/GlideBridge'

export function glide(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    const glideBridge = new GlideBridge(bridge)
    let current = glideBridge as GlideBridge

    for (let i = 0; i < steps.length; ++i) {
      current = new GlideBridge(steps[i].apply(current))
    }

    return current.flush()
  })
}
