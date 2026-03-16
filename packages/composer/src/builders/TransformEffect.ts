import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'
import { ScopeBuilder } from '../interfaces/scope-builder'

/**
 * Base class for post-processing transforms that capture notes after composition,
 * apply a transformation, then replay the result onto the bridge.
 *
 * Uses a **capture-transform-replay** pattern distinct from interceptors (e.g.
 * {@link TieBridge}, {@link HarmonizeBridge}) which wrap the pipeline and mutate
 * state during composition. TransformEffect runs its scope on a recording bridge,
 * collects all emitted notes, invokes the subclass `replay` implementation,
 * and writes the transformed notes to the target bridge.
 *
 * Supports `.steps()` and `.default()` like {@link ScopedBuilder}.
 * Subclasses include {@link ReverseBuilder} and {@link StretchBuilder}.
 * Detected by {@link isTransformEffect} and partitioned via {@link partitionEffects}.
 *
 * @example
 * ```ts
 * reverse().steps(note('C4'), note('D4'), note('E4'))  // Emits E4, D4, C4
 * stretch(2).steps(chord('Cmaj7'))                     // Doubles chord duration
 * reverse().default()                                  // No scoped steps (pass-through)
 * ```
 */
const IS_TRANSFORM = Symbol('TransformEffect')

export abstract class TransformEffect<T extends TransformEffect<T>> implements ScopeBuilder<T> {
  /** Brand symbol for {@link isTransformEffect} type guard. */
  static readonly IS_TRANSFORM = IS_TRANSFORM

  readonly [IS_TRANSFORM] = true

  /** Pipe-step groups to run in the capture phase; each group applied in sequence. */
  protected readonly entries: PipeStep[][]

  protected constructor(entries: PipeStep[][]) {
    this.entries = entries
  }

  /**
   * Create a new instance with the given entries.
   * Subclasses must override to preserve concrete type in method chains.
   *
   * @param entries - New pipe-step groups for the scope
   * @returns New transform instance (concrete subclass)
   */
  protected abstract cloneWithEntries(entries: PipeStep[][]): T

  /**
   * Transform captured notes and replay them onto the bridge.
   * Subclasses implement the actual transformation logic (e.g. reverse ticks,
   * stretch durations) and emit transformed notes via `bridge.withNote()`.
   *
   * @param notes - Notes captured from the scope composition pass
   * @param totalDuration - Total duration of the captured clip in ticks
   * @param bridge - Target bridge to receive transformed notes
   * @returns Bridge with transformed notes emitted
   */
  protected abstract replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge

  /**
   * Append pipe steps to this transform's scope.
   * Steps are run during the capture phase; their output is then transformed and replayed.
   *
   * @param pipeSteps - Steps to run within this transform's scope (e.g. notes, chords)
   * @returns New transform with the appended steps (immutable)
   */
  steps(...pipeSteps: PipeStep[]): T {
    return this.cloneWithEntries(appendSteps(this.entries, pipeSteps))
  }

  /**
   * Clear the scope and mark as a downstream default (pass-through).
   * With no entries, `apply` returns the bridge unchanged.
   *
   * @returns New transform with empty entries
   */
  default(): T {
    return this.cloneWithEntries([])
  }

  /**
   * Execute the capture-transform-replay pipeline.
   *
   * **Phase 1 (Capture):** Run `entries` through a fresh {@link BaseCompositionBridge}
   * and a {@link RecordingBridge}, then collect all emitted notes via
   * {@link CapturedNote}.
   *
   * **Phase 2 (Transform + Replay):** Delegate to subclass `replay`, which transforms
   * the captured notes (e.g. reversing ticks, stretching durations) and emits them
   * onto the provided bridge.
   *
   * When `entries` is empty, returns the bridge unchanged.
   *
   * @param bridge - Current composition state
   * @returns Bridge with transformed notes replayed at the current tick
   */
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

/**
 * Type guard for {@link TransformEffect} instances.
 *
 * Used by {@link partitionEffects} to separate post-processing transforms from
 * interceptors when partitioning a flat effect list.
 *
 * @param step - Any {@link PipeStep} (e.g. from a pipe or steps array)
 * @returns `true` if `step` is a TransformEffect (reverse, stretch, etc.)
 */
export function isTransformEffect(step: PipeStep): step is TransformEffect<any> {
  return IS_TRANSFORM in step
}
