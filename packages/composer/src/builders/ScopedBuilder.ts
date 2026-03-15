import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { partitionEffects } from '../utils/partition-effects'
import { TransformEffect } from './TransformEffect'
import { ScopeBuilder } from '../interfaces/scope-builder'

export interface ScopedParams {
  effects: PipeStep[]
  entries: PipeStep[][]
}

/**
 * Composes multiple effects (interceptors + transforms) into one scoped block.
 *
 * Usage:
 *   scoped(humanize(20, 10), swing(0.6)).steps(note('C4'), note('D4'))
 *   scoped(humanize(20, 10), reverse()).steps(use(melodyClip))
 *
 * Effects are stored in a single ordered array.
 * During apply(), interceptors wrap the bridge (pre-composition),
 * transforms post-process (post-composition) — both in user-specified order
 * within their respective phase.
 */
export class ScopedBuilder implements ScopeBuilder<ScopedBuilder> {
  private readonly effects: PipeStep[]
  private readonly _entries: PipeStep[][]

  constructor(params: Partial<ScopedParams> = {}) {
    this.effects = params.effects ?? []
    this._entries = params.entries ?? []
  }

  /** Add steps to this scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): ScopedBuilder {
    return new ScopedBuilder({
      effects: this.effects,
      entries: appendSteps(this._entries, pipeSteps),
    })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const { interceptors, transforms } = partitionEffects(this.effects)

    if (this._entries.length === 0) {
      // No content — apply all effects as defaults (cascade downstream)
      let target = bridge

      for (let i = 0; i < this.effects.length; ++i) {
        target = this.effects[i].apply(target)
      }

      return target
    }

    // Apply interceptors as default (unscoped) to wrap the bridge
    let wrappedBridge = bridge

    for (let i = 0; i < interceptors.length; ++i) {
      wrappedBridge = interceptors[i].apply(wrappedBridge)
    }

    // Run entries through the wrapped bridge in user-specified order
    const target = applyEntries(this._entries, wrappedBridge)

    // Unwrap back to outer bridge at the new tick
    let result = bridge.withTick(target.tick)

    // Apply transforms as post-processors on the content entries
    for (let i = 0; i < transforms.length; ++i) {
      let transformWithContent: TransformEffect<any> = transforms[i]

      for (let j = 0; j < this._entries.length; ++j) {
        transformWithContent = transformWithContent.steps(...this._entries[j])
      }

      result = transformWithContent.apply(bridge)
    }

    return result
  }
}
