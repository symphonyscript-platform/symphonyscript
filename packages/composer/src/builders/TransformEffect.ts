import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'
import { ScopeBuilder } from '../interfaces/scope-builder'

/**
 * Marker + base class for post-processing transforms (reverse, stretch).
 *
 * Unlike ScopedEffectBuilder which wraps bridges before composition,
 * TransformEffect captures all notes AFTER composition, transforms them,
 * then replays the transformed notes onto the bridge.
 *
 * Supports `.steps()` and `.default()` like ScopedEffectBuilder.
 */
const IS_TRANSFORM = Symbol('TransformEffect')

export abstract class TransformEffect<T extends TransformEffect<T>> implements ScopeBuilder<T> {
  static readonly IS_TRANSFORM = IS_TRANSFORM

  readonly [IS_TRANSFORM] = true

  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][]) {
    this.entries = entries
  }

  /** Clone with updated entries. */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T

  /**
   * Transform recorded notes and replay them onto the bridge.
   * Subclasses implement the actual transformation logic.
   */
  protected abstract replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge

  /** Add steps to this transform's scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /** Explicitly mark as a downstream default. */
  default(): T {
    return this.cloneWithEntries([])
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.entries.length === 0) {
      return bridge
    }

    // Capture notes by running entries through a fresh bridge + recording
    const captureBridge = new BaseCompositionBridge({
      tick: 0,
      velocity: bridge.velocity,
      transpose: bridge.transpose,
      defaultDuration: bridge.defaultDuration,
    })

    const composed = applyEntries(this.entries, captureBridge)

    // Commit to recorder and collect notes
    const recorder = new RecordingBridge()
    composed.commit(recorder)
    const frozen = recorder.toFrozenClip()

    const notes: CapturedNote[] = []

    frozen.visitNotes((_sourceId, pitch, velocity, duration, tick, muted) => {
      notes.push({ pitch, velocity, duration, tick, muted })
    })

    return this.replay(notes, frozen.duration, bridge)
  }
}

/** Type guard for TransformEffect instances. */
export function isTransformEffect(step: PipeStep): step is TransformEffect<any> {
  return IS_TRANSFORM in step
}
