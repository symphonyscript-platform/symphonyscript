import type { PipeStep } from '@symphonyscript/composer'
import { StretchBuilder } from '../builders/StretchBuilder'

/** Time-stretch contained steps or clips by factor. */
export function stretch(factor?: number, ...pipeSteps: PipeStep[]): StretchBuilder {
  const builder = new StretchBuilder({ factor })
  if (pipeSteps.length === 0) return builder
  return builder.steps(...pipeSteps)
}
