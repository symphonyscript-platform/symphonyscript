import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToCents } from '@symphonyscript/theory'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'
import { ScaleIntervals } from '@symphonyscript/core'

/**
 * Configuration for {@link HarmonizeBridge}.
 */
export interface HarmonizeBridgeParams {
  /**
   * Diatonic intervals to harmonize above each note.
   *
   * Values are 1-based scale degrees relative to the input note.
   * E.g. `[3, 5]` adds a third and fifth above each note in the current scale.
   */
  intervals: readonly number[]
}

/**
 * Bridge decorator that adds diatonic harmony voices to every emitted note.
 *
 * For each note, finds its scale degree in the current key context, then
 * emits additional notes at the specified diatonic intervals above it.
 * All harmony notes are emitted at the same tick as the original note.
 *
 * When `precise` mode is active, harmony is bypassed — notes pass through
 * unmodified (useful for notes that should not be harmonized).
 *
 * @example
 * ```ts
 * // harmonize([3, 5]).steps(note('C4'))
 * // In C major: emits C4, E4 (third), G4 (fifth)
 * ```
 */
export class HarmonizeBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: HarmonizeBridgeParams,
  ) {
    super(bridge)
  }

  /**
   * Emit the original note, then resolve and emit harmony voices.
   *
   * Skips harmonization when `precise` is active (returns rewrapped pass-through).
   * For each interval, finds the input note's scale degree via brute-force
   * search in cents, then computes the harmonized pitch using `degreeToCents`.
   * Silently skips intervals that can't be resolved (note not in scale).
   *
   * @param pitch - Pitch in cents
   * @param duration - Note duration in ticks
   * @param velocity - Optional velocity override
   *
   * @returns Updated bridge with original + harmony notes emitted
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    let target = this.bridge.withNote(pitch, duration, velocity)

    const intervals = this.scaleIntervals
    if (intervals === null) return this.rewrap(target)

    for (let i = 0; i < this.params.intervals.length; ++i) {
      const interval = this.params.intervals[i]

      const originalDegree = this.findScaleDegree(pitch, intervals)
      if (originalDegree === null) continue

      const harmonizedCents = this.scaleRootCents
        + degreeToCents(intervals, originalDegree + interval - 1)

      target = target
        .withTick(this.tick)
        .withNote(harmonizedCents, duration, velocity)
    }

    return this.rewrap(target)
  }

  /** @internal Preserves harmonize params when re-wrapping. */
  protected rewrap(bridge: CompositionBridge): HarmonizeBridge {
    return new HarmonizeBridge(bridge, this.params)
  }

  /**
   * Find which scale degree produces the given pitch (in cents).
   *
   * Searches degrees 1–14 (two octaves) in the given scale intervals.
   * Returns `null` if the pitch is chromatic (not in the scale).
   */
  private findScaleDegree(pitch: number, intervals: ScaleIntervals): number | null {
    for (let degree = 1; degree <= 14; ++degree) {
      const degreeCents = this.scaleRootCents + degreeToCents(intervals, degree)
      if (degreeCents === pitch) return degree
    }

    return null
  }
}
