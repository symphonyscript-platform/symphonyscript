import { PipeStep, step } from '@symphonyscript/composer'

export function rest(duration: number): PipeStep {
  return step((bridge) => bridge.withTick(bridge.tick + duration))
}
