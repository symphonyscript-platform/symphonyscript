import { PipeStep } from './pipe-step'
import { CompositionBridge } from './composition-bridge'
import { Composable } from './composable'

export interface IClip extends Composable {
  pipe(...steps: PipeStep[]): IClip
}
