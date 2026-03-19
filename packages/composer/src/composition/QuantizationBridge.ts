import { CompositionBridge } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Parameters for {@link QuantizationBridge}.
 */
export interface QuantizationBridgeParams {
  /** Grid size in ticks (e.g., 480 for 8th notes at 960 PPQ). Notes snap to multiples of this. */
  grid: number
  /** Quantization intensity: 0 = no change, 1 = full snap to grid, 0.5 = halfway between. */
  strength: number
}

/**
 * Bridge decorator that snaps note onset ticks toward the nearest grid points.
 *
 * For each note, computes `nearest = round(tick / grid) × grid` and
 * `quantized = round(tick + (nearest - tick) × strength)`. The note is emitted
 * at the quantized tick. Strength 0 leaves ticks unchanged; strength 1 fully
 * snaps to the grid; partial values interpolate between original and grid.
 * When `precise` is active, quantization is bypassed.
 *
 * Immutable — each state transition returns a new `QuantizationBridge` instance.
 *
 * @example
 * ```ts
 * // Full snap to 8th-note grid (960 PPQ)
 * new QuantizationBridge(bridge, { grid: 480, strength: 1 })
 * ```
 *
 * @example
 * ```ts
 * // Partial quantization for humanized feel
 * new QuantizationBridge(bridge, { grid: 480, strength: 0.5 })
 * ```
 *
 * @example
 * ```ts
 * // 16th-note grid, no quantization (strength 0)
 * new QuantizationBridge(bridge, { grid: 240, strength: 0 })
 * ```
 */
export class QuantizationBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: QuantizationBridgeParams,
  ) {
    super(bridge)
  }

  /**
   * Emit a note at a quantized tick.
   *
   * Tick is blended toward the nearest grid point: `quantized = tick + (nearest - tick) × strength`.
   * The bridge tick is updated to the quantized value before emission.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in beats. Falls back to `defaultDuration`.
   * @param velocity - Optional velocity override

   * @returns New bridge state with note emitted at quantized tick
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    const nearest = Math.round(this.tick / this.params.grid) * this.params.grid
    const quantized = Math.round(this.tick + (nearest - this.tick) * this.params.strength)

    return this.rewrap(
      this.bridge.withTick(quantized).withNote(pitch, duration, velocity)
    )
  }

  /** @internal Preserves quantization params when the decorator is re-wrapped. */
  protected rewrap(bridge: CompositionBridge): QuantizationBridge {
    return new QuantizationBridge(bridge, this.params)
  }
}
