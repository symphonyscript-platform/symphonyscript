import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

/**
 * Build a {@link PipeStep} from an apply function. Lets you define inline or
 * functional pipe steps without implementing the full PipeStep interface.
 *
 * Used internally by {@link tie}, {@link glide}, {@link harmonize}, and other
 * cues that wrap bridge logic into a single step.
 *
 * @param apply - Function that receives the current bridge and returns the
 *   updated bridge after applying this step (typically immutable).
 * @returns A PipeStep whose `apply` delegates to the given function.
 *
 * @example
 * // Identity step (no-op)
 * step((bridge) => bridge)
 *
 * @example
 * // Transform context
 * step((bridge) => bridge.withVelocity(200).withTranspose(5))
 *
 * @example
 * // CC control
 * step((bridge) => bridge.withCC(64, 127))
 *
 * @example
 * // Wrap in a bridge (e.g. harmonize)
 * step((bridge) => new HarmonizeBridge(bridge, { intervals: [0, 4, 7] }))
 */
export function step(apply: (bridge: CompositionBridge) => CompositionBridge): PipeStep {
  return { apply };
}
