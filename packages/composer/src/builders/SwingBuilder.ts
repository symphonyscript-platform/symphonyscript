import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { SwingBridge, SwingBridgeParams } from '../composition/SwingBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'

/**
 * Parameters for {@link SwingBuilder}.
 */
export interface SwingParams extends SwingBridgeParams {
  /** Pipe-step groups to apply within this scope. Passed through from {@link ScopedStepBuilder}. */
  entries: PipeStep[][]
}

/**
 * Immutable builder for swing feel: delays offbeat notes within a grid to produce triplet-like timing.
 *
 * Implements {@link ScopeBuilder}. In scoped mode, swing applies only to steps passed to
 * `steps()`. In default mode (after `default()`), the modification cascades downstream for
 * subsequent pipeline steps. Uses {@link SwingBridge} to shift offbeat note positions.
 *
 * @example
 * ```ts
 * swing(0.5).steps(note('C4'), note('D4'))   // Triplet swing on inner notes only
 * swing(0).steps(note('C4'))                 // Straight timing (no swing)
 * swing(1.0).default()                       // Dotted swing cascades downstream
 * swing().amount(0.6).grid(0.5).steps(...)   // Custom amount and 16th-note grid
 * swing(0.5, 1)                            // Triplet swing, 8th-note grid (1 beat)
 * ```
 */
export class SwingBuilder extends ScopedStepBuilder<SwingBuilder> {
  private readonly params: Omit<SwingParams, 'entries'>

  constructor(params: Partial<SwingParams>) {
    super(params.entries ?? [])
    this.params = {
      amount: params.amount ?? 0.5,
      grid: params.grid ?? 1,
    }
  }

  /**
   * Set the swing amount (strength). Controls how much offbeat notes are delayed.
   *
   * @param amount - Swing ratio 0..1: 0 = straight, 0.5 = triplet swing, 1.0 = dotted swing

   * @returns New builder with the updated amount
   */
  amount(amount: number): SwingBuilder {
    return this.clone({ amount })
  }

  /**
   * Set the grid division in beats. Offbeat detection uses `position % (grid * 2)`.
   *
   * @param grid - Grid size in beats (e.g. 1 = quarter note, 0.5 = 8th note)

   * @returns New builder with the updated grid
   */
  grid(grid: number): SwingBuilder {
    return this.clone({ grid })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new SwingBridge(bridge, this.params)
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries })
  }

  /** @internal */
  private clone(overrides: Partial<SwingParams>): SwingBuilder {
    return new SwingBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
