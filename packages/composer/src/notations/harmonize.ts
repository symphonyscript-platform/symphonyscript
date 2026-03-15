import { PipeStep, step } from '@symphonyscript/composer'
import { HarmonizeBridge } from '../composition/HarmonizeBridge'

export function harmonize(...intervals: number[]): PipeStep {
  return step((bridge) => new HarmonizeBridge(bridge, { intervals }))
}
