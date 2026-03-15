import { PipeStep, step } from '@symphonyscript/composer'

export function bend(value: number): PipeStep {
  return step((bridge) => bridge.withBend(value))
}
