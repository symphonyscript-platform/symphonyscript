import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { DynamicsBridge, DynamicsBridgeParams } from '../composition/DynamicsBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'

/**
 * Parameters for {@link DynamicsBuilder}.
 */
export interface DynamicsParams extends DynamicsBridgeParams {
  /** Pipe-step groups to apply within this scope. Passed through from {@link ScopedStepBuilder}. */
  entries: PipeStep[][]
}

/**
 * Immutable builder for dynamic markings: linearly ramps velocity over a beat range (e.g. pp → mf → ff).
 *
 * Implements {@link ScopeBuilder}. In scoped mode, the ramp applies only to steps passed to
 * `steps()`. In default mode (after `default()`), the modification cascades downstream.
 * Uses {@link DynamicsBridge} to interpolate velocity from startVelocity to endVelocity between
 * startBeat and endBeat.
 *
 * @example
 * ```ts
 * dynamics(400, 1000).steps(note('C4'), note('D4'))   // pp to ff on inner notes
 * dynamics(600, 800, 0, 1)                         // mf to f, beats 0..1
 * dynamics().default()                               // Ramp cascades downstream
 * dynamics(200, 900).start(0).end(2)              // Explicit beat range
 * dynamics(600, 600).steps(note('C4'))              // Flat mf
 * ```
 */
export class DynamicsBuilder extends ScopedStepBuilder<DynamicsBuilder> {
  private readonly params: Omit<DynamicsParams, 'entries'>

  constructor(params: Partial<DynamicsParams>) {
    super(params.entries ?? [])
    this.params = {
      startVelocity: params.startVelocity ?? 600,
      endVelocity: params.endVelocity ?? 1000,
      startBeat: params.startBeat ?? 0,
      endBeat: params.endBeat ?? 1,
    }
  }

  /**
   * Set the velocity at the start of the ramp.
   *
   * @param velocity - Velocity (0–1000) at startBeat

   * @returns New builder with the updated start velocity
   */
  startVelocity(velocity: number): DynamicsBuilder {
    return this.clone({ startVelocity: velocity })
  }

  /**
   * Set the velocity at the end of the ramp.
   *
   * @param velocity - Velocity (0–1000) at endBeat

   * @returns New builder with the updated end velocity
   */
  endVelocity(velocity: number): DynamicsBuilder {
    return this.clone({ endVelocity: velocity })
  }

  /**
   * Set the beat position at which the ramp begins.
   *
   * @param beat - Start beat of the velocity range

   * @returns New builder with the updated start beat
   */
  start(beat: number): DynamicsBuilder {
    return this.clone({ startBeat: beat })
  }

  /**
   * Set the beat position at which the ramp ends.
   *
   * @param beat - End beat of the velocity range

   * @returns New builder with the updated end beat
   */
  end(beat: number): DynamicsBuilder {
    return this.clone({ endBeat: beat })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    return new DynamicsBridge(bridge, this.params)
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, entries })
  }

  /** @internal */
  private clone(overrides: Partial<DynamicsParams>): DynamicsBuilder {
    return new DynamicsBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
