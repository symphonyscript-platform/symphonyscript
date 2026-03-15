import { PipeStep, step } from '@symphonyscript/composer'
import { TieBridge } from '../composition/TieBridge'

export function tie(...steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    const tieBridge = new TieBridge(bridge)

    let current = tieBridge as TieBridge

    for (let i = 0; i < steps.length; ++i) {
      const step = steps[i]
      const result = step.apply(current)

      if (result instanceof TieBridge) {
        current = result
      } else {
        current = new TieBridge(result)
      }
    }

    return current.flush()
  })
}
