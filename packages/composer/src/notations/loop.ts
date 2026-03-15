import { LoopBuilder } from '../builders/LoopBuilder'
import { PipeStep } from '@symphonyscript/composer'

export function loop(count?: number, ...pipeSteps: PipeStep[]): LoopBuilder {
  return new LoopBuilder({ count, pipeSteps })
}
