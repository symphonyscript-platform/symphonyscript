import type { PipeStep } from '@symphonyscript/composer'
import { LoopBuilder } from '../builders/LoopBuilder'

/** Repeat a step n times sequentially. */
export function repeat(count: number, source: PipeStep): LoopBuilder {
  return new LoopBuilder({ count, pipeSteps: [source] })
}
