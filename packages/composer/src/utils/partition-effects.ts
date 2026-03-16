import type { PipeStep } from '@symphonyscript/composer'
import { isTransformEffect, TransformEffect } from '../builders/TransformEffect'

/**
 * Result of splitting a flat `PipeStep[]` into two groups by effect type.
 *
 * **Interceptors** are bridge wrappers (e.g. {@link TieBridge}, {@link HarmonizeBridge})
 * that wrap the composition pipeline and apply during composition. They mutate
 * composition state or context as notes flow through.
 *
 * **Transforms** are post-processing effects (reverse, stretch, etc.) that capture
 * notes after composition, apply their transformation, then replay the result
 * onto the bridge.
 */
export interface PartitionedEffects {
  /** PipeSteps that wrap bridges and apply during composition (non-TransformEffect). */
  readonly interceptors: PipeStep[]
  /** Post-processing effects that capture, transform, and replay notes onto the bridge. */
  readonly transforms: TransformEffect<any>[]
}

/**
 * Partition an array of effects into interceptors (bridge wrappers) and transforms
 * (post-processing effects like reverse/stretch).
 *
 * Preserves user-specified order within each group. Used by {@link ScopedBuilder}
 * to separate pipeline-wrapping steps from capture-and-replay transforms.
 *
 * @param effects - Flat array of PipeSteps from `.pipe()` / `.steps()` calls

 * @returns Object with `interceptors` and `transforms` arrays, each in original order
 */
export function partitionEffects(effects: PipeStep[]): PartitionedEffects {
  const interceptors: PipeStep[] = []
  const transforms: TransformEffect<any>[] = []

  for (let i = 0; i < effects.length; ++i) {
    const effect = effects[i]

    if (isTransformEffect(effect)) {
      transforms.push(effect)
    } else {
      interceptors.push(effect)
    }
  }

  return { interceptors, transforms }
}
