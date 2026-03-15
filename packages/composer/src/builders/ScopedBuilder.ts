import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Composable } from '../interfaces/composable'
import type { ScopeEntry } from '../utils/scope-entries'
import { appendStepsEntry, appendClipEntry, applyEntries } from '../utils/scope-entries'
import { partitionEffects } from '../utils/partition-effects'
import { TransformEffect } from './TransformEffect'

export interface ScopedParams {
  effects: PipeStep[]
  entries: ScopeEntry[]
}

/**
 * Composes multiple effects (interceptors + transforms) into one scoped block.
 *
 * Usage:
 *   scoped(humanize(20, 10), swing(0.6)).steps(note('C4'), note('D4'))
 *   scoped(humanize(20, 10), reverse()).use(melodyClip)
 *
 * Effects are stored in a single ordered array.
 * During apply(), interceptors wrap the bridge (pre-composition),
 * transforms post-process (post-composition) — both in user-specified order
 * within their respective phase.
 */
export class ScopedBuilder implements PipeStep {
  private readonly effects: PipeStep[]
  private readonly _entries: ScopeEntry[]

  constructor(params: Partial<ScopedParams> = {}) {
    this.effects = params.effects ?? []
    this._entries = params.entries ?? []
  }

  /** Scope to the given steps (overrides previous steps). */
  steps(...pipeSteps: PipeStep[]): ScopedBuilder {
    return new ScopedBuilder({
      effects: this.effects,
      entries: appendStepsEntry(this._entries, pipeSteps),
    })
  }

  /** Add a clip to the scope (accumulates). */
  use(clip: Composable): ScopedBuilder {
    return new ScopedBuilder({
      effects: this.effects,
      entries: appendClipEntry(this._entries, clip),
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
        const entry = this._entries[j]

        if (entry.kind === 'steps') {
          transformWithContent = transformWithContent.steps(...entry.steps)
        } else {
          transformWithContent = transformWithContent.use(entry.clip)
        }
      }

      result = transformWithContent.apply(bridge)
    }

    return result
  }
}
