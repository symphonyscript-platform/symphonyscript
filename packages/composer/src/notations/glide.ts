import { PipeStep, step } from '@symphonyscript/composer'
import { GlideBridge } from '../composition/GlideBridge'

export function glide(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    const glideBridge = new GlideBridge(bridge)
    let current = glideBridge as GlideBridge

    for (let i = 0; i < steps.length; ++i) {
      const step = steps[i]
      const result = step.apply(current)

      if (result instanceof GlideBridge) {
        current = result
      } else {
        current = new GlideBridge(result)
      }
    }

    return current.flush()
  })
}
