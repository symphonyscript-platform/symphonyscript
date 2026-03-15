import { PipeStep, step } from '@symphonyscript/composer'
import { SwingBridge } from '../composition/SwingBridge'

export function swing(
  amount: number,  // 0.0 = straight, 0.5 = triplet swing, 1.0 = dotted swing
  grid: number,    // grid division in ticks (e.g., 480 for 8th notes at 960 PPQ)
): PipeStep {
  return step((bridge) => {
    return new SwingBridge(bridge, {
      amount,
      grid,
    })
  })
}
