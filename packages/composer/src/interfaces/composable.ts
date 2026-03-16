import type { CompositionBridge } from '@symphonyscript/composer'

/**
 * Minimal interface for composing into a bridge. Extending types (e.g. {@link IClip})
 * implement this to drive {@link CompositionBridge} and produce an updated bridge.
 *
 * Used by {@link Clip.compose}, {@link freeze}, and {@link use}.
 */
export interface Composable {
  /**
   * Run this composable into the given bridge, producing a new bridge with
   * accumulated state (deferred events, topology, context).
   *
   * @param bridge - The {@link CompositionBridge} to compose into.

   * @returns A new bridge with this composable's contributions applied.
   */
  compose(bridge: CompositionBridge): CompositionBridge
}
