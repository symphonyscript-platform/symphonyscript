import { PipeStep } from './pipe-step'
import { CompositionBridge } from './composition-bridge'

export interface IClip {
  pipe(...steps: PipeStep[]): IClip
  compose(context: CompositionBridge): CompositionBridge
}
