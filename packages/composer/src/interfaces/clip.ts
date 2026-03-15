import { PipeStep } from './pipe-step'
import { CompositionBridge } from './composition-bridge'

export interface Clip {
  pipe(...steps: PipeStep[]): Clip
  compose(context: CompositionBridge): CompositionBridge
}
