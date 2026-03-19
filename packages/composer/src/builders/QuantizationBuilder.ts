import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { QuantizationBridge, QuantizationBridgeParams } from '../composition/QuantizationBridge'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import { ScopedStepBuilder } from './ScopedStepBuilder'

/**
 * Parameters for {@link QuantizationBuilder}.
 *
 * Extends {@link QuantizationBridgeParams} with scoped step entries.
 */
export interface QuantizationParams extends QuantizationBridgeParams {
  /** Pipe-step groups to apply within the quantization scope. */
  entries: PipeStep[][]
}

/**
 * Quantizes note timing for contained steps to a regular grid.
 *
 * Extends {@link ScopedStepBuilder}: supports scoped mode (quantize only
 * inner steps) and default mode (cascade downstream). Wraps the bridge in
 * {@link QuantizationBridge}, which snaps each note's tick toward the nearest
 * grid point: `quantizedTick = tick + (round(tick/grid)*grid - tick) * strength`.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * quantize(1).steps(note('C4'), note('E4'))   // Scoped: quantize only these
 * quantize(0.5, 0.5).default()                 // Cascade: 50% snap downstream
 * quantize(1).grid(2).strength(1).steps(note('C4'))
 * ```
 */
export class QuantizationBuilder extends ScopedStepBuilder<QuantizationBuilder> {
  private readonly params: Omit<QuantizationParams, 'entries'>

  constructor(params: Partial<QuantizationParams>) {
    super(params.entries ?? [])
    this.params = {
      grid: params.grid ?? 1,
      strength: params.strength ?? 1.0,
    }
  }

  /**
   * Set the quantization grid size in beats.
   *
   * Notes snap toward multiples of this value (e.g. 1 = quarter-note grid).
   *
   * @param grid - Grid size in beats (positive)
   * @returns New builder with the updated grid
   */
  grid(grid: number): QuantizationBuilder {
    return this.clone({ grid })
  }

  /**
   * Set quantization strength (0.0 = no snap, 1.0 = full snap).
   *
   * Interpolates between original tick and nearest grid point: higher values pull notes closer to the grid.
   *
   * @param strength - 0.0–1.0 (default 1.0)

   * @returns New builder with the updated strength
   */
  strength(strength: number): QuantizationBuilder {
    return this.clone({ strength })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new QuantizationBridge(bridge, this.params)
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<QuantizationParams>): QuantizationBuilder {
    return new QuantizationBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
