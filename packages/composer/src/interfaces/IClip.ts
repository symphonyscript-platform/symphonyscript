import { PipeStep } from './pipe-step'
import { Composable } from './composable'

/**
 * Main clip interface for the composition API. Extends {@link Composable}
 * with a fluent `pipe` method to chain transformation steps.
 *
 * {@link Clip} is the canonical implementation.
 */
export interface IClip extends Composable {
  /**
   * Append transformation steps to this clip. Returns a new clip with the
   * additional steps; original clip is unchanged.
   *
   * @param steps - One or more {@link PipeStep}s to apply in sequence during composition.

   * @returns A new clip with the appended steps (implementations typically return {@link Clip}).
   */
  pipe(...steps: PipeStep[]): IClip
}
