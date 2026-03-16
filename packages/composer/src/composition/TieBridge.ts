import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Bridge decorator that merges consecutive same-pitch notes into a single
 * sustained note (tie behavior).
 *
 * When `withNote` receives the same pitch as the previous call, the duration
 * is accumulated instead of emitting a new note. When a different pitch
 * arrives (or {@link flush} is called), the accumulated note is emitted
 * with the total accumulated duration.
 *
 * Immutable — each state transition returns a new `TieBridge` instance.
 *
 * @example
 * ```ts
 * // tie(note('C4'), note('C4'), note('E4'))
 * // → emits C4 at duration 960 (480+480), then E4 at duration 480
 * ```
 */
export class TieBridge extends CompositionBridgeDecorator {
  private readonly lastPitch: number | null
  private readonly accumulatedDuration: number

  /**
   * @param bridge - Inner bridge to delegate to
   * @param lastPitch - Pitch being accumulated, or `null` if no tie is pending
   * @param accumulatedDuration - Total duration accumulated for `lastPitch`
   */
  constructor(
    bridge: CompositionBridge,
    lastPitch: number | null = null,
    accumulatedDuration: number = 0,
  ) {
    super(bridge)
    this.lastPitch = lastPitch
    this.accumulatedDuration = accumulatedDuration
  }

  /**
   * Receive a note. If pitch matches the pending tie, accumulate its duration.
   * Otherwise, flush the pending tie and start a new one.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in ticks. Falls back to `defaultDuration`.
   * @param velocity - Optional velocity override

   * @returns New bridge state (TieBridge wrapping the updated inner bridge)
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    const dur = duration ?? this.defaultDuration

    if (this.lastPitch === pitch) {
      return new TieBridge(
        this.bridge.withTick(this.tick + dur),
        pitch,
        this.accumulatedDuration + dur,
      )
    }

    let target = this.flush()
    target = target.withNote(pitch, dur, velocity)

    return new TieBridge(
      target,
      pitch,
      dur,
    )
  }

  /**
   * Emit the accumulated tied note to the inner bridge.
   *
   * Rewinds tick to the tie start position, emits a single note with
   * the full accumulated duration, then restores the current tick.
   *
   * No-op if no tie is pending (`lastPitch` is `null` or duration is 0).
   */
  flush(): CompositionBridge {
    if (this.lastPitch !== null && this.accumulatedDuration > 0) {
      const emitTick = this.tick - this.accumulatedDuration
      return this.bridge
        .withTick(emitTick)
        .withNote(this.lastPitch, this.accumulatedDuration)
        .withTick(this.tick)
    }

    return this.bridge
  }

  /** @internal Preserves tie state when the decorator is re-wrapped. */
  protected rewrap(bridge: CompositionBridge): TieBridge {
    return new TieBridge(bridge, this.lastPitch, this.accumulatedDuration)
  }
}
