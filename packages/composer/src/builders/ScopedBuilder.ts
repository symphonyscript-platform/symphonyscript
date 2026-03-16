import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { partitionEffects } from '../utils/partition-effects'
import { TransformEffect } from './TransformEffect'
import { ScopeBuilder } from '../interfaces/scope-builder'

/**
 * Internal parameters for {@link ScopedBuilder} construction.
 *
 * Used when cloning or constructing via the notation factory.
 */
export interface ScopedParams {
  /** Ordered array of effects (interceptors + transforms) to apply. Defaults to `[]`. */
  effects: PipeStep[]
  /** Groups of pipe steps to run within the scope. Defaults to `[]`. */
  entries: PipeStep[][]
}

/**
 * Composes multiple effects (interceptors + transforms) into one scoped block.
 *
 * Unlike {@link ScopedStepBuilder}, which wraps a single bridge via onEnter/onExit,
 * ScopedBuilder accepts an arbitrary list of effects and partitions them into
 * interceptors (bridge wrappers) and transforms (post-processors). When steps are
 * provided, interceptors wrap the bridge first, entries run through the wrapped
 * bridge, then transforms post-process the composed content. When no steps are
 * given, all effects cascade as defaults (each wraps the bridge in sequence).
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * scoped(humanize(20, 10), swing(0.6)).steps(note('C4'), note('D4'))
 * scoped(humanize(20, 10), reverse()).steps(use(melodyClip))
 * scoped(sustain()).steps(note('C4'), note('E4'))  // sustain applies to notes only
 * scoped(sustain())                                // no steps → sustain cascades downstream
 * scoped()                                         // no effects, no steps → pass-through
 * ```
 */
export class ScopedBuilder implements ScopeBuilder<ScopedBuilder> {
  private readonly effects: PipeStep[]
  private readonly _entries: PipeStep[][]

  /** @internal */
  constructor(params: Partial<ScopedParams> = {}) {
    this.effects = params.effects ?? []
    this._entries = params.entries ?? []
  }

  /**
   * Add steps to this scope. Each call appends a new entry group; steps run
   * in the order they were added.
   *
   * @param pipeSteps - One or more {@link PipeStep}s to run within this scope
   * @returns New ScopedBuilder with the appended steps
   */
  steps(...pipeSteps: PipeStep[]): ScopedBuilder {
    return new ScopedBuilder({
      effects: this.effects,
      entries: appendSteps(this._entries, pipeSteps),
    })
  }

  /**
   * Apply this scoped block to the bridge.
   *
   * **When entries are empty (default/cascade mode):**
   * Each effect wraps the bridge in sequence; the result cascades downstream.
   * Equivalent to composing effects without scoped content.
   *
   * **When entries exist (scoped mode):**
   * 1. Partition effects into interceptors (bridge wrappers) and transforms
   *    ({@link TransformEffect} post-processors).
   * 2. Apply interceptors to wrap the bridge in user-specified order.
   * 3. Run all entry groups through the wrapped bridge via {@link applyEntries}.
   * 4. For each transform, bind its steps to the corresponding entry group and
   *    apply the transform to the composed result.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with effects and content applied
   */
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
    let result = applyEntries(this._entries, wrappedBridge)

    // Apply transforms as post-processors on the content entries
    for (let i = 0; i < transforms.length; ++i) {
      let transformWithContent: TransformEffect<any> = transforms[i]

      for (let j = 0; j < this._entries.length; ++j) {
        transformWithContent = transformWithContent.steps(...this._entries[j])
      }

      result = transformWithContent.apply(result)
    }

    return result
  }
}
