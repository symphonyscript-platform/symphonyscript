import { PipeStep, step } from '@symphonyscript/composer'

export function loop(count: number, steps: PipeStep[]): PipeStep {
  return step((bridge) => {
    let current = bridge

    for (let i = 0; i < count; ++i) {
      for (let j = 0; j < steps.length; ++j) {
        current = steps[j].apply(current)
      }
    }

    return current
  })
}
