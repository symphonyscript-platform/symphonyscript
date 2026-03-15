import type { PipeStep } from '@symphonyscript/composer'
import { ReverseBuilder } from '../builders/ReverseBuilder'

/** Reverse the order of contained steps or clips. */
export function reverse(...pipeSteps: PipeStep[]): ReverseBuilder {
  if (pipeSteps.length === 0) return new ReverseBuilder()
  return new ReverseBuilder().steps(...pipeSteps)
}
