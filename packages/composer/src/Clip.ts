import { IClip } from './interfaces/IClip'
import { PipeStep } from './interfaces/pipe-step'
import { CompositionBridge } from './interfaces/composition-bridge'
import { freeze } from './utils/freeze'
import { IFrozenClip } from './interfaces/frozen-clip'
import type { Notation } from '@symphonyscript/core'

/**
 * Main clip class implementing {@link IClip}. Entry point for composition: holds a
 * chain of {@link PipeStep}s and composes them sequentially into a
 * {@link CompositionBridge}.
 *
 * Immutable builder pattern: `pipe()` returns a new Clip; the original is unchanged.
 *
 * @example
 * ```ts
 * Clip.pipe(note('C4'), quantize(480))
 * ```
 *
 * @example
 * ```ts
 * note('C4').pipe(glide(0.5), swing(0.1))
 * ```
 *
 * @example
 * ```ts
 * Clip.freeze(chord('Am').pipe(reverse()), notation)
 * ```
 */
export class Clip implements IClip {
  constructor(private readonly steps: PipeStep[]) {}

  /**
   * Create a clip from a chain of transformation steps.
   *
   * @param steps - {@link PipeStep}s to apply in sequence during composition.
   *
   * @returns New Clip with the given steps.
   */
  static pipe(...steps: PipeStep[]): Clip {
    return new Clip(steps)
  }

  /**
   * Compose the clip and capture its output as an immutable {@link IFrozenClip}.
   *
   * @param clip - Clip to compose and capture.
   * @param notation - Notation instance for pitch/interval resolution.
   *
   * @returns Immutable snapshot of notes, CC events, and bends.
   */
  static freeze(clip: IClip, notation: Notation): IFrozenClip {
    return freeze(clip, notation)
  }

  /**
   * Append transformation steps. Returns a new Clip; this clip is unchanged.
   *
   * @param steps - {@link PipeStep}s to append (applied after existing steps).
   *
   * @returns New Clip with the appended steps.
   */
  pipe(...steps: PipeStep[]): Clip {
    return new Clip([...this.steps, ...steps])
  }

  /**
   * Run composition: apply all steps in order to the bridge. Each step's
   * `apply()` receives the bridge and returns an updated bridge; the final
   * bridge is returned.
   *
   * @param context - Initial composition bridge.
   *
   * @returns Bridge with all steps applied.
   */
  compose(context: CompositionBridge): CompositionBridge {
    const steps = this.steps
    let bridge = context

    for (let i = 0; i < steps.length; ++i) {
      bridge = steps[i].apply(bridge)
    }

    return bridge
  }
}
