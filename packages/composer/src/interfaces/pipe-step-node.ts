import { PipeStep } from './pipe-step'

export interface PipeStepNode {
  readonly steps: PipeStep[]
  readonly prev: PipeStepNode | null
}
