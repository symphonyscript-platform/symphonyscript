import type { CompositionBridge } from '@symphonyscript/composer'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

/**
 * Parameters for {@link RatioHarmonyBuilder}.
 *
 * Extends {@link PitchStepParams} with cent interval offsets and root.
 */
export interface RatioHarmonyParams extends PitchStepParams {
  /** Cent intervals from root (e.g. [0, 386, 702] for just major triad). */
  intervals: number[]
  /** Root pitch in absolute cents from C0. Default: 4800 (C4). */
  root: number
}

/**
 * Immutable builder that emits simultaneous notes from cent interval offsets.
 *
 * Unlike {@link HarmonyBuilder} which uses 24-EDO bitmasks, this stores
 * cent interval offsets from the root directly. Used by the `ratios()` cue
 * for frequency-ratio-based chord construction.
 *
 * Extends {@link PitchStepBuilder}, inheriting all modifiers:
 * `.sharp()`, `.flat()`, `.up()`, `.down()`, `.staccato()`, `.transpose()`,
 * `.detune()`, `.velocity()`, `.repeat()`, `.accent()`, `.marcato()`, etc.
 *
 * @example
 * ```ts
 * ratios([1, 5/4, 3/2]).sharp().up().staccato()
 * ratios([1, 6/5, 3/2], 5700).velocity(800)
 * ```
 */
export class RatioHarmonyBuilder extends PitchStepBuilder<RatioHarmonyBuilder> {
  private readonly _intervals: number[]
  private readonly _root: number

  constructor(params: Partial<RatioHarmonyParams>) {
    super(params)
    this._intervals = params.intervals ?? [0]
    this._root = params.root ?? 4800
  }

  /**
   * Set the root pitch in absolute cents from C0.
   *
   * @param rootCents - Absolute cents (e.g. 4800 = C4, 5700 = A4)
   * @returns New RatioHarmonyBuilder with the updated root
   */
  root(rootCents: number): RatioHarmonyBuilder {
    return new RatioHarmonyBuilder({
      ...this.shared,
      intervals: this._intervals,
      root: rootCents,
    })
  }

  /**
   * Emit all interval pitches as simultaneous notes on the bridge.
   *
   * Each interval is added to the root, then accidental, octave shift,
   * and transpose are applied (all in cents). All notes emit at the same
   * tick, then tick advances by duration.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with chord notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let target = this.applyFlags(bridge)
    const scaledDuration = this.resolvedDuration()

    const resolvedRoot = this._root
      + this.shared.accidental
      + (this.shared.octaveShift * 1200)
      + this.shared.transposeCents

    for (let rep = 0; rep < this.shared.repeatCount; ++rep) {
      const startTick = target.tick

      for (let i = 0; i < this._intervals.length; ++i) {
        const pitchCents = resolvedRoot + this._intervals[i]
        target = target.withTick(startTick).withNote(
          pitchCents,
          scaledDuration,
          this.shared.velocity ?? undefined,
        )
      }

      // Advance tick by duration after all notes emitted
      const advanceDur = scaledDuration ?? bridge.defaultDuration
      target = target.withTick(startTick + advanceDur)
    }

    return this.resetFlags(target)
  }

  /** @internal Creates a new RatioHarmonyBuilder preserving intervals and root. */
  protected create(params: Partial<PitchStepParams>): RatioHarmonyBuilder {
    return new RatioHarmonyBuilder({
      ...params,
      intervals: this._intervals,
      root: this._root,
    })
  }
}
