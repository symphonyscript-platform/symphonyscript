import { PipeStep } from './pipe-step'
import { Composable } from './composable'

export interface IClip extends Composable {
  pipe(...steps: PipeStep[]): IClip
}
