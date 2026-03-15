import { PipeStep } from '@symphonyscript/composer'
import type { Composable } from './composable'

export interface ScopeBuilder<T extends ScopeBuilder<T>> extends PipeStep {
  steps(...pipeSteps: PipeStep[]): T
  use(clip: Composable): T
}
