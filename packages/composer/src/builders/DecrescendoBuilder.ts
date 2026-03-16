import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { EasingCurve } from '../composition/VelocityRampBridge'
import { VelocityRampBridge } from '../composition/VelocityRampBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'

/**
 * Parameters for {@link DecrescendoBuilder}.
 */
export interface DecrescendoParams {
  /** Length of the diminuendo in ticks. Default 480. */
  duration: number
  /** Initial velocity. Default 1000. */
  from: number
  /** Final velocity. Default 400. */
  to: number
  /** Easing curve for the ramp. Default `'linear'`. */
  curve: EasingCurve
  /** Pipe-step groups to apply within this scope. Passed through from {@link ScopedStepBuilder}. */
  entries: PipeStep[][]
}

/**
 * Immutable builder for decrescendo/diminuendo: ramps velocity from loud to soft over a duration.
 *
 * Implements {@link ScopeBuilder}. In scoped mode, the ramp applies only to steps passed to
 * `steps()`. In default mode (after `default()`), the modification cascades downstream.
 * Uses {@link VelocityRampBridge}; ramp starts at bridge.tick and spans `duration` ticks.
 *
 * @example
 * ```ts
 * decrescendo(960).steps(note('C4'), note('D4'))   // Decrease volume over 960 ticks
 * decrescendo().from(1000).to(200).steps(...)     // Custom from/to velocities
 * decrescendo(480).curve('exponential')            // Exponential fall
 * decrescendo().default()                          // Diminuendo cascades downstream
 * decrescendo(240)                                 // Short 240-tick diminuendo
 * ```
 */
export class DecrescendoBuilder extends ScopedStepBuilder<DecrescendoBuilder> {
  private readonly params: Omit<DecrescendoParams, 'entries'>

  constructor(params: Partial<DecrescendoParams>) {
    super(params.entries ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 1000,
      to: params.to ?? 400,
      curve: params.curve ?? 'linear',
    }
  }

  /**
   * Set the duration of the diminuendo in ticks.
   *
   * @param duration - Length of the ramp in ticks
   * @returns New builder with the updated duration
   */
  duration(duration: number): DecrescendoBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the initial velocity at the start of the ramp.
   *
   * @param from - Velocity at bridge.tick (start of ramp)
   * @returns New builder with the updated from velocity
   */
  from(from: number): DecrescendoBuilder {
    return this.clone({ from })
  }

  /**
   * Set the final velocity at the end of the ramp.
   *
   * @param to - Velocity at bridge.tick + duration
   * @returns New builder with the updated to velocity
   */
  to(to: number): DecrescendoBuilder {
    return this.clone({ to })
  }

  /**
   * Set the easing curve for the velocity ramp.
   *
   * @param curve - One of `'linear'`, `'exponential'`, `'smooth'`
   * @returns New builder with the updated curve
   */
  curve(curve: EasingCurve): DecrescendoBuilder {
    return this.clone({ curve })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new VelocityRampBridge(bridge, {
      startTick: bridge.tick,
      endTick: bridge.tick + this.params.duration,
      fromVelocity: this.params.from,
      toVelocity: this.params.to,
      curve: this.params.curve,
    })
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, entries })
  }

  /** @internal */
  private clone(overrides: Partial<DecrescendoParams>): DecrescendoBuilder {
    return new DecrescendoBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
