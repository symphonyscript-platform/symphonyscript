import { ScopedStepBuilder } from './ScopedStepBuilder'
import { EasingCurve, VelocityRampBridge } from '../composition/VelocityRampBridge'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'

/**
 * Parameters for {@link CrescendoBuilder}.
 */
export interface CrescendoParams {
  /** Length of the crescendo in ticks. Default 480. */
  duration: number
  /** Initial velocity. Default 400. */
  from: number
  /** Final velocity. Default 1200 (scaled, or use MIDI range 0–127). */
  to: number
  /** Easing curve for the ramp. Default `'linear'`. */
  curve: EasingCurve
  /** Pipe-step groups to apply within this scope. Passed through from {@link ScopedStepBuilder}. */
  entries: PipeStep[][]
}

/**
 * Immutable builder for crescendo: ramps velocity from soft to loud over a duration.
 *
 * Implements {@link ScopeBuilder}. In scoped mode, the ramp applies only to steps passed to
 * `steps()`. In default mode (after `default()`), the modification cascades downstream.
 * Uses {@link VelocityRampBridge}; ramp starts at bridge.tick and spans `duration` ticks.
 *
 * @example
 * ```ts
 * crescendo(960).steps(note('C4'), note('D4'))   // Increase volume over 960 ticks
 * crescendo().from(200).to(1000).steps(...)      // Custom from/to velocities
 * crescendo(480).curve('exponential')            // Exponential rise
 * crescendo().default()                          // Crescendo cascades downstream
 * crescendo(240)                                 // Short 240-tick crescendo
 * ```
 */
export class CrescendoBuilder extends ScopedStepBuilder<CrescendoBuilder> {
  private readonly params: Omit<CrescendoParams, 'entries'>

  constructor(params: Partial<CrescendoParams>) {
    super(params.entries ?? [])
    this.params = {
      duration: params.duration ?? 480,
      from: params.from ?? 400,
      to: params.to ?? 1200,
      curve: params.curve ?? 'linear',
    }
  }

  /**
   * Set the duration of the crescendo in ticks.
   *
   * @param duration - Length of the ramp in ticks
   * @returns New builder with the updated duration
   */
  duration(duration: number): CrescendoBuilder {
    return this.clone({ duration })
  }

  /**
   * Set the initial velocity at the start of the ramp.
   *
   * @param from - Velocity at bridge.tick (start of ramp)
   * @returns New builder with the updated from velocity
   */
  from(from: number): CrescendoBuilder {
    return this.clone({ from })
  }

  /**
   * Set the final velocity at the end of the ramp.
   *
   * @param to - Velocity at bridge.tick + duration
   * @returns New builder with the updated to velocity
   */
  to(to: number): CrescendoBuilder {
    return this.clone({ to })
  }

  /**
   * Set the easing curve for the velocity ramp.
   *
   * @param curve - One of `'linear'`, `'exponential'`, `'smooth'`
   * @returns New builder with the updated curve
   */
  curve(curve: EasingCurve): CrescendoBuilder {
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
  protected cloneWithEntries(entries: PipeStep[][]): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, entries })
  }

  /** @internal */
  private clone(overrides: Partial<CrescendoParams>): CrescendoBuilder {
    return new CrescendoBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}