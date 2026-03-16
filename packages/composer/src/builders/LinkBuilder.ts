import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'
import { partitionEffects } from '../utils/partition-effects'
import { ScopeBuilder } from '../interfaces/scope-builder'
import { use as usecue } from '../cues/use'

/**
 * Parameters for {@link LinkBuilder}.
 *
 * Used internally when constructing and cloning link instances.
 */
export interface LinkParams {
  /** The clip or step to link (insert at current tick). */
  clip: Composable
  /** Amplitude or topology weight. Default 1. Stored with the link for downstream consumers. */
  weight: number
  /** Ordered array of effects (interceptors and transforms) to apply to the linked clip. */
  effects: PipeStep[]
}

/**
 * Immutable builder that links a clip (or step) into the composition via {@link use}.
 *
 * Inserts the composed output of another clip at the current tick without
 * recomposing it. Enables repetition and reuse of pre-defined material
 * ( melodies, progressions, patterns) with optional effects.
 *
 * Effects are partitioned into **interceptors** (bridge wrappers like humanize,
 * swing) that run before the clip composes, and **transforms** (reverse,
 * stretch) that post-process the clip content after composition.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * use(melody)                                          // Insert melody at current tick
 * use(melody).weight(0.8)                              // Configure weight for downstream
 * use(melody).effects(humanize(20, 10), swing(0.6))    // Interceptor + interceptor
 * use(melody).effects(reverse())                        // Transform: reverse composed notes
 * use(chordClip).weight(0.8).effects(humanize(20, 10), reverse())
 * ```
 */
export class LinkBuilder implements PipeStep {
  private readonly params: LinkParams

  constructor(params: Partial<LinkParams> & { clip: Composable }) {
    this.params = {
      clip: params.clip,
      weight: params.weight ?? 1,
      effects: params.effects ?? [],
    }
  }

  /**
   * Set the amplitude or topology weight for this link.
   *
   * @param weight - Numeric weight (typically 0–1)

   * @returns New LinkBuilder with the updated weight
   */
  weight(weight: number): LinkBuilder {
    return this.clone({ weight })
  }

  /**
   * Set effects to apply to the linked clip. Replaces any previously configured effects.
   *
   * Interceptors (e.g. humanize, swing) wrap the bridge before composition.
   * Transforms (e.g. reverse) capture notes after composition, apply the
   * transformation, and replay onto the bridge.
   *
   * @param effectList - One or more {@link PipeStep}s (interceptors or transforms)

   * @returns New LinkBuilder with the specified effects
   */
  effects(...effectList: ScopeBuilder<any>[]): LinkBuilder {
    return this.clone({ effects: effectList })
  }

  /**
   * Compose the linked clip into the bridge at the current tick.
   *
   * If no effects are configured, delegates directly to {@link Composable.compose}.
   * Otherwise, runs interceptors in order (wrapping the bridge), composes the clip
   * through the wrapped bridge, then applies transforms as post-processors on the
   * composed content (via {@link use} cue for scoping).
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with the linked clip's content emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const { clip, effects } = this.params

    if (effects.length === 0) {
      return clip.compose(bridge)
    }

    const { interceptors, transforms } = partitionEffects(effects)

    // Apply interceptors (wrap bridge before clip composes)
    let wrappedBridge = bridge

    for (let i = 0; i < interceptors.length; ++i) {
      wrappedBridge = interceptors[i].apply(wrappedBridge)
    }

    // Compose clip through wrapped bridge
    let result = clip.compose(wrappedBridge)

    // Apply transforms as post-processors on the clip content
    for (let i = 0; i < transforms.length; ++i) {
      result = transforms[i].steps(usecue(clip)).apply(result)
    }

    return result
  }

  /** @internal Creates a new LinkBuilder with merged overrides. */
  private clone(overrides: Partial<LinkParams>): LinkBuilder {
    return new LinkBuilder({ ...this.params, ...overrides })
  }
}

