import { PipeStep } from '@symphonyscript/composer'

export interface ScopeBuilder<T extends ScopeBuilder<T>> extends PipeStep {
  steps(...pipeSteps: PipeStep[]): T
}
