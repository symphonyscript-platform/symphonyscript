import { PipeStep, step } from '@symphonyscript/composer'
import { QuantizationBridge } from '../composition/QuantizationBridge'

export function swing(
  grid: number,      // grid size in ticks
  strength: number,  // 0.0 = no quantize, 1.0 = full snap
): PipeStep {
  return step((bridge) => {
    return new QuantizationBridge(bridge, {
      grid,
      strength,
    })
  })
}
