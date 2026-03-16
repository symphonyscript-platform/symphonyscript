import { CompositionBridge } from '@symphonyscript/composer'
import { ExecutionContext } from '@symphonyscript/core'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

/**
 * Abstract base for decorator bridges that wrap an inner {@link CompositionBridge}.
 * Implements the decorator pattern: wrap/unwrap with delegation to the inner bridge.
 * Subclasses override `withNote`, `withCC`,
 * etc., then call `rewrap(innerResult)` to preserve the decorator type.
 *
 * All state getters (tick, velocity, transpose, etc.) delegate to the inner bridge.
 * The default implementation passes events through unchanged; subclasses such as
 * {@link TieBridge} and {@link HarmonizeBridge} intercept and transform events before
 * forwarding.
 *
 * @example
 * ```ts
 * // TieBridge overrides withNote to merge consecutive same-pitch notes
 * class TieBridge extends CompositionBridgeDecorator {
 *   override withNote(...) { /* merge logic, then rewrap(target) *\/ }
 *   protected rewrap(b: CompositionBridge) { return new TieBridge(b, ...) }
 * }
 * ```
 *
 * @example
 * ```ts
 * // HarmonizeBridge overrides withNote to add diatonic harmony voices
 * class HarmonizeBridge extends CompositionBridgeDecorator {
 *   override withNote(...) { /* emit original + harmony, then rewrap *\/ }
 *   protected rewrap(b: CompositionBridge) { return new HarmonizeBridge(b, params) }
 * }
 * ```
 */
export abstract class CompositionBridgeDecorator implements CompositionBridge {
  /**
   * @param bridge - Inner bridge to delegate to; receives transformed events
   */
  constructor(protected readonly bridge: CompositionBridge) {}

  get tick() { return this.bridge.tick }
  get velocity() { return this.bridge.velocity }
  get transpose() { return this.bridge.transpose }
  get defaultDuration() { return this.bridge.defaultDuration }
  get tempo() { return this.bridge.tempo }
  get timeSignatureNum() { return this.bridge.timeSignatureNum }
  get timeSignatureDen() { return this.bridge.timeSignatureDen }
  get scaleRoot() { return this.bridge.scaleRoot }
  get scaleMode() { return this.bridge.scaleMode }
  get keyRoot() { return this.bridge.keyRoot }
  get keyMode() { return this.bridge.keyMode }
  get volume() { return this.bridge.volume }
  get pan() { return this.bridge.pan }
  get swing() { return this.bridge.swing }
  get muted() { return this.bridge.muted }
  get precise() { return this.bridge.precise }
  get quantizeGrid() { return this.bridge.quantizeGrid }
  get quantizeStrength() { return this.bridge.quantizeStrength }

  /**
   * Forward note to inner bridge, then rewrap to preserve decorator type.
   * Subclasses override to intercept and transform before forwarding.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in ticks. Default: defaultDuration
   * @param velocity - Optional velocity override
   * @returns New decorator wrapping the updated inner bridge
   */
  withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  /**
   * Forward CC to inner bridge, then rewrap.
   *
   * @param controller - MIDI CC number (0–127)
   * @param value - CC value (0–127)
   * @returns New decorator wrapping the updated inner bridge
   */
  withCC(controller: number, value: number): CompositionBridge {
    return this.rewrap(this.bridge.withCC(controller, value))
  }

  /**
   * Forward pitch bend to inner bridge, then rewrap.
   *
   * @param value - Pitch bend value
   * @returns New decorator wrapping the updated inner bridge
   */
  withBend(value: number): CompositionBridge {
    return this.rewrap(this.bridge.withBend(value))
  }

  /**
   * Forward aftertouch to inner bridge, then rewrap.
   *
   * @param value - Aftertouch value (0–127)
   * @param pitch - Optional MIDI pitch for poly aftertouch
   * @returns New decorator wrapping the updated inner bridge
   */
  withAftertouch(value: number, pitch?: number): CompositionBridge {
    return this.rewrap(this.bridge.withAftertouch(value, pitch))
  }

  /**
   * Forward connect to inner bridge, then rewrap.
   *
   * @param srcId - Source node id
   * @param tgtId - Target node id
   * @param weight - Optional connection weight
   * @returns New decorator wrapping the updated inner bridge
   */
  withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge {
    return this.rewrap(this.bridge.withConnect(srcId, tgtId, weight))
  }

  /**
   * Forward disconnect to inner bridge, then rewrap.
   *
   * @param srcId - Source node id
   * @param tgtId - Target node id
   * @returns New decorator wrapping the updated inner bridge
   */
  withDisconnect(srcId: number, tgtId: number): CompositionBridge {
    return this.rewrap(this.bridge.withDisconnect(srcId, tgtId))
  }

  /**
   * Forward reclaim to inner bridge, then rewrap.
   *
   * @param nodePtr - Node pointer to reclaim
   * @returns New decorator wrapping the updated inner bridge
   */
  withReclaim(nodePtr: number): CompositionBridge {
    return this.rewrap(this.bridge.withReclaim(nodePtr))
  }

  // === Delegated state modifiers — rewrap ===

  /** @internal */
  withVelocity(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withVelocity(v))
  }

  /** @internal */
  withTranspose(s: number): CompositionBridge {
    return this.rewrap(this.bridge.withTranspose(s))
  }

  /** @internal */
  withDefaultDuration(d: number): CompositionBridge {
    return this.rewrap(this.bridge.withDefaultDuration(d))
  }

  /** @internal */
  withTempo(bpm: number): CompositionBridge {
    return this.rewrap(this.bridge.withTempo(bpm))
  }

  /** @internal */
  withTimeSignature(num: number, den: number): CompositionBridge {
    return this.rewrap(this.bridge.withTimeSignature(num, den))
  }

  /** @internal */
  withScale(root: PitchClass, mode: ScaleMode): CompositionBridge {
    return this.rewrap(this.bridge.withScale(root, mode))
  }

  /** @internal */
  withKey(root: PitchClass, mode: ScaleMode): CompositionBridge {
    return this.rewrap(this.bridge.withKey(root, mode))
  }

  /** @internal */
  withSwing(amount: number): CompositionBridge {
    return this.rewrap(this.bridge.withSwing(amount))
  }

  /** @internal */
  withVolume(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withVolume(v))
  }

  /** @internal */
  withPan(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withPan(v))
  }

  /** @internal */
  withQuantize(grid: number, strength?: number): CompositionBridge {
    return this.rewrap(this.bridge.withQuantize(grid, strength))
  }

  /** @internal */
  withTick(tick: number): CompositionBridge {
    return this.rewrap(this.bridge.withTick(tick))
  }

  /** @internal */
  withMuted(muted: boolean): CompositionBridge {
    return this.rewrap(this.bridge.withMuted(muted))
  }

  /** @internal */
  withPrecise(precise: boolean): CompositionBridge {
    return this.rewrap(this.bridge.withPrecise(precise))
  }

  /**
   * Delegate commit to the inner bridge. Executes all accumulated thunks.
   *
   * @param ctx - Execution context (e.g. {@link RecordingBridge}) that receives events
   */
  commit(ctx: ExecutionContext): void {
    this.bridge.commit(ctx)
  }

  /**
   * Strip this decorator and return the inner bridge with all accumulated thunks.
   * Use when the decorator layer is no longer needed.
   *
   * @returns The inner bridge (possibly another decorator or {@link BaseCompositionBridge})
   */
  unwrap(): CompositionBridge {
    return this.bridge
  }

  /**
   * Wrap the updated inner bridge in a new decorator instance of the same subclass.
   * Preserves decorator-specific state (e.g. TieBridge lastPitch, HarmonizeBridge params).
   * Subclasses must implement to maintain type when forwarding events.
   *
   * @param bridge - Inner bridge after a delegated call (withNote, withTick, etc.)
   * @returns New decorator instance wrapping the given bridge
   */
  protected abstract rewrap(bridge: CompositionBridge): CompositionBridgeDecorator
}
