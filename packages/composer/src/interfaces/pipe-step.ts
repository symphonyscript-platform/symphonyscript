import { CompositionBridge } from './composition-bridge'

/**
 * Core interface for a single composition step. All builders and notations
 * produce PipeSteps that can be chained via {@link IClip.pipe}.
 */
export interface PipeStep {
  /**
   * Apply this step to the bridge, mutating composition state (notes, CCs,
   * topology) or context (velocity, tempo, scale, etc.) as appropriate.
   *
   * @param bridge - Current composition state and accumulator
   * @returns New bridge with this step applied (typically immutable)
   */
  apply(bridge: CompositionBridge): CompositionBridge
}
