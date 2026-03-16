import type { CompositionBridge } from '@symphonyscript/composer'

/**
 * Parameters for {@link RatioHarmonyBuilder}.
 */
export interface RatioHarmonyParams {
  /** Cent intervals from root (e.g. [0, 386, 702] for just major triad). */
  intervals: number[]
  /** Root pitch in absolute cents from C0. Default: 4800 (C4). */
  root: number
  /** Duration in ticks. `null` = bridge default. */
  duration: number | null
  /** Velocity override. `null` = bridge default. */
  velocity: number | null
  /** Number of times to emit the chord. Default: 1. */
  repeatCount: number
}

/**
 * Immutable builder that emits simultaneous notes from cent interval offsets.
 *
 * Unlike {@link HarmonyBuilder} which uses 24-EDO bitmasks, this stores
 * cent interval offsets from the root directly. Used by the `ratios()` cue
 * for frequency-ratio-based chord construction.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * new RatioHarmonyBuilder({ intervals: [0, 386, 702], root: 4800 })
 * ```
 */
export class RatioHarmonyBuilder {
  private readonly _intervals: number[]
  private readonly _root: number
  private readonly _duration: number | null
  private readonly _velocity: number | null
  private readonly _repeatCount: number

  constructor(params: Partial<RatioHarmonyParams>) {
    this._intervals = params.intervals ?? [0]
    this._root = params.root ?? 4800
    this._duration = params.duration ?? null
    this._velocity = params.velocity ?? null
    this._repeatCount = params.repeatCount ?? 1
  }

  /** Set velocity for all emitted notes. */
  velocity(v: number): RatioHarmonyBuilder {
    return new RatioHarmonyBuilder({
      intervals: this._intervals,
      root: this._root,
      duration: this._duration,
      velocity: v,
      repeatCount: this._repeatCount,
    })
  }

  /** Set repeat count. */
  repeat(count: number): RatioHarmonyBuilder {
    return new RatioHarmonyBuilder({
      intervals: this._intervals,
      root: this._root,
      duration: this._duration,
      velocity: this._velocity,
      repeatCount: count,
    })
  }

  /**
   * Emit all interval pitches as simultaneous notes on the bridge.
   *
   * Each interval is added to the root to produce an absolute cent pitch.
   * All notes emit at the same tick, then tick advances by duration.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with chord notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let target = bridge
    const dur = this._duration

    for (let rep = 0; rep < this._repeatCount; ++rep) {
      const startTick = target.tick

      for (let i = 0; i < this._intervals.length; ++i) {
        const pitchCents = this._root + this._intervals[i]
        target = target.withTick(startTick).withNote(
          pitchCents,
          dur ?? undefined,
          this._velocity ?? undefined,
        )
      }

      // Advance tick by duration after all notes emitted
      const advanceDur = dur ?? target.defaultDuration
      target = target.withTick(startTick + advanceDur)
    }

    return target
  }
}
