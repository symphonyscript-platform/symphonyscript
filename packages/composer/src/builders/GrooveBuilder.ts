import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { GrooveBridge, GrooveBridgeParams, GrooveStep } from '../composition/GrooveBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import type { PipeStep } from '@symphonyscript/composer'
import { KNUTH_MULTIPLIER } from '../constants'

const DEFAULT_STEP: GrooveStep = {
  velocity: 1.0,
  timing: 0,
  probability: 1.0,
}

/**
 * Parameters for {@link GrooveBuilder}.
 */
export interface GrooveParams extends Omit<GrooveBridgeParams, 'rng'> {
  /** Seeded RNG for per-step probability. `null` uses tick-derived seed. */
  rng: SeededRandom | null
  /** Pipe-step groups to apply within the groove scope. */
  entries: PipeStep[][]
}

/**
 * Groove template. Wraps inner steps in a {@link GrooveBridge} that applies
 * per-grid-step velocity scaling, timing offsets, and probability to each
 * emitted note. Step index = floor(tick / grid) % steps.length.
 *
 * Extends {@link ScopedStepBuilder}. In scoped mode, applies only to steps
 * passed to `steps()`. In default mode (no steps or after `default()`), the
 * groove cascades downstream. All builder methods return new instances
 * (clone-on-set immutability).
 *
 * @example
 * ```ts
 * groove(1).step(0.8).step(1.0).step(0.6).steps(note('C4'), note('D4'))
 * groove(1).step(1, 0.1).step(0.5, -0.05).steps(note('E4'))
 * groove(0.5).grid(0.5).step(1, 0, 0.8).steps(chord('Am7'))
 * groove(1).step(0.9).default()  // Cascade downstream
 * groove(1).seed(42)
 * ```
 */
export class GrooveBuilder extends ScopedStepBuilder<GrooveBuilder> {
  private readonly params: Omit<GrooveParams, 'entries'>

  constructor(params: Partial<GrooveParams>) {
    super(params.entries ?? [])
    this.params = {
      steps: params.steps ?? [],
      grid: params.grid ?? 1,
      rng: params.rng ?? null,
    }
  }

  /**
   * Add a groove step. Steps cycle per grid division; each note uses the
   * step at index floor(tick / grid) % steps.length.
   *
   * @param velocity - Velocity scale (1.0 = unchanged). Default 1.0
   * @param timing - Timing offset as fraction of grid (-1 to 1). Default 0 (no offset)
   * @param probability - Probability of sounding (0–1). Default 1.0

   * @returns New builder with the step appended
   */
  step(velocity?: number, timing?: number, probability?: number): GrooveBuilder {
    const newStep: GrooveStep = {
      velocity: velocity ?? DEFAULT_STEP.velocity,
      timing: timing ?? DEFAULT_STEP.timing,
      probability: probability ?? DEFAULT_STEP.probability,
    }
    return this.clone({ steps: [...this.params.steps, newStep] })
  }

  /**
   * Set velocity of the last groove step.
   *
   * @param velocity - Velocity scale (1.0 = unchanged)

   * @returns New builder with last step updated
   */
  velocityLast(velocity: number): GrooveBuilder {
    return this.modifyLast({ velocity })
  }

  /**
   * Set timing offset of the last groove step.
   *
   * @param timing - Fraction of grid for tick offset

   * @returns New builder with last step updated
   */
  timingLast(timing: number): GrooveBuilder {
    return this.modifyLast({ timing })
  }

  /**
   * Set probability of the last groove step.
   *
   * @param probability - Value in 0–1

   * @returns New builder with last step updated
   */
  probabilityLast(probability: number): GrooveBuilder {
    return this.modifyLast({ probability })
  }

  /**
   * Set the grid division in beats. Step index = floor(tick / grid) % steps.length.
   *
   * @param grid - Grid size in beats (e.g. 1 = quarter note)

   * @returns New builder with the updated grid
   */
  grid(grid: number): GrooveBuilder {
    return this.clone({ grid })
  }

  /**
   * Set the RNG seed for reproducible per-step probability rolls.
   *
   * @param seed - Integer seed for {@link SeededRandom}

   * @returns New builder with the given RNG seed
   */
  seed(seed: number): GrooveBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  /** @internal */
  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    const rng = this.params.rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new GrooveBridge(bridge, { ...this.params, rng })
  }

  /** @internal */
  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  /** @internal */
  protected cloneWithEntries(entries: PipeStep[][]): GrooveBuilder {
    return new GrooveBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<GrooveParams>): GrooveBuilder {
    return new GrooveBuilder({
      ...this.params,
      entries: this.entries,
      ...overrides,
    })
  }

  private modifyLast(overrides: Partial<GrooveStep>): GrooveBuilder {
    const currentSteps = this.params.steps

    if (currentSteps.length === 0) {
      return this.step(overrides.velocity, overrides.timing, overrides.probability)
    }

    const last = currentSteps[currentSteps.length - 1]
    const updated = [...currentSteps]

    updated[updated.length - 1] = { ...last, ...overrides }

    return this.clone({ steps: updated })
  }
}
