import type { PipeStep } from '@symphonyscript/composer'
import { isTransformEffect, TransformEffect } from '../builders/TransformEffect'

export interface PartitionedEffects {
  readonly interceptors: PipeStep[]
  readonly transforms: TransformEffect<any>[]
}

/**
 * Partition an array of effects into interceptors (bridge wrappers)
 * and transforms (post-processing effects like reverse/stretch).
 * Preserves user-specified order within each group.
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
