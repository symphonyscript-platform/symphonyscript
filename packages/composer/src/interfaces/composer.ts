import { PipeStep } from './pipe-step'
import { CompositionBridge } from './composition-bridge'

export interface Composer {
  pipe(...steps: PipeStep[]): Composer
  compose(context: CompositionBridge): CompositionBridge
}
