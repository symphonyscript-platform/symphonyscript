import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Parameters for {@link SwingBridge}.
 */
export interface SwingBridgeParams {
  /** Swing intensity: 0 = straight, 0.5 = triplet swing, 1.0 = dotted swing. */
  amount: number
  /** Grid division in beats (e.g., 0.5 for 8th notes). Defines the two-beat cycle. */
  grid: number
}

/**
 * Bridge decorator that delays offbeat notes to create swing feel.
 *
 * Notes are classified by position within a two-beat cycle (2 × grid beats).
 * Onbeat notes (first half of cycle) pass through unchanged. Offbeat notes
 * (second half) receive a timing offset of `round(amount × grid × 0.5)` beats.
 * When `precise` is active, swing is bypassed and notes pass through unmodified.
 *
 * Immutable — each state transition returns a new `SwingBridge` instance.
 *
 * @example
 * ```ts
 * // swing(0.5, 1): triplet feel — offbeat at beat 1 gets +0.25 beats
 * new SwingBridge(bridge, { amount: 0.5, grid: 1 })
 * ```
 *
 * @example
 * ```ts
 * // swing(1.0, 1): dotted feel — offbeat gets +0.5 beats (half the grid)
 * new SwingBridge(bridge, { amount: 1.0, grid: 1 })
 * ```
 *
 * @example
 * ```ts
 * // swing(0, 1): straight — no offset regardless of position
 * new SwingBridge(bridge, { amount: 0, grid: 1 })
 * ```
 */
export class SwingBridge extends CompositionBridgeDecorator {
  constructor(bridge: CompositionBridge, private readonly params: SwingBridgeParams) {
    super(bridge)
  }

  /**
   * Emit a note. Onbeat notes pass through; offbeat notes are delayed by the swing offset.
   *
   * Position is computed as `tick % (grid × 2)`. If position ≥ grid, the note is offbeat
   * and its tick is advanced by `round(amount × grid × 0.5)` before emission.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in beats. Falls back to `defaultDuration`.
   * @param velocity - Optional velocity override

   * @returns New bridge state with note emitted (possibly with adjusted tick)
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const position = this.tick % (this.params.grid * 2)
    const isOffbeat = position >= this.params.grid

    if (isOffbeat) {
      const offset = Math.round(this.params.amount * this.params.grid * 0.5)
      return this.rewrap(
        this.bridge.withTick(this.tick + offset).withNote(pitch, duration, velocity)
      )
    }

    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  /** @internal Preserves swing params when the decorator is re-wrapped. */
  protected rewrap(bridge: CompositionBridge): SwingBridge {
    return new SwingBridge(bridge, this.params)
  }
}
