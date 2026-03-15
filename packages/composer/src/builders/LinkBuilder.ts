import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'
import { partitionEffects } from '../utils/partition-effects'
import { ScopeBuilder } from '../interfaces/scope-builder'

export interface LinkParams {
  clip: Composable
  weight: number
  effects: PipeStep[]
}

/**
 * Builder for clip wiring via use().
 *
 * Usage:
 *   use(melody)
 *   use(melody).weight(0.8)
 *   use(melody).effects(humanize(20, 10), swing(0.6))
 *   use(melody).weight(0.8).effects(humanize(20, 10), reverse())
 *
 * Effects are stored in a single ordered array.
 * Interceptors wrap before clip composition, transforms post-process after.
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

  weight(weight: number): LinkBuilder {
    return this.clone({ weight })
  }

  /** Set effects to apply to this clip (overrides). */
  effects(...effectList: ScopeBuilder<any>[]): LinkBuilder {
    return this.clone({ effects: effectList })
  }

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
    const composed = clip.compose(wrappedBridge)

    // Unwrap to outer bridge position
    let result = bridge.withTick(composed.tick)

    // Apply transforms as post-processors on the clip content
    for (let i = 0; i < transforms.length; ++i) {
      result = transforms[i].use(clip).apply(bridge)
    }

    return result
  }

  private clone(overrides: Partial<LinkParams>): LinkBuilder {
    return new LinkBuilder({ ...this.params, ...overrides })
  }
}
