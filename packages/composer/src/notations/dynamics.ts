import { PipeStep, step } from '@symphonyscript/composer'
import { DynamicsBridge } from '../composition/DynamicsBridge'

export function dynamics(
  startVelocity: number, // velocity at start tick
  endVelocity: number,   // velocity at end tick
  startTick: number,     // range start
  endTick: number,       // range end
): PipeStep {
  return step((bridge) => {
    return new DynamicsBridge(bridge, {
      startVelocity,
      endVelocity,
      startTick,
      endTick,
    })
  })
}
