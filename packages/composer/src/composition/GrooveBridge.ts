import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Per-step overrides for groove application.
 */
export interface GrooveStep {
  /** Velocity multiplier. 1.0 = unchanged; 0.5 = half velocity. */
  velocity: number
  /** Timing offset as fraction of grid (e.g. 0.1 = 10% of grid in ticks). */
  timing: number
  /** Probability of sounding (0–1). 1.0 = always; 0.5 = 50% chance per step. */
  probability: number
}

/**
 * Configuration for {@link GrooveBridge}.
 */
export interface GrooveBridgeParams {
  /** Repeating step pattern; index = floor(tick / grid) % steps.length. */
  steps: readonly GrooveStep[]
  /** Grid division in ticks. Step index and timing offsets are derived from this. */
  grid: number
  /** Seeded RNG for probability rolls (step.probability < 1). */
  rng: SeededRandom
}

/**
 * Bridge decorator that applies a groove template to emitted notes.
 *
 * Maps each note to a repeating step pattern based on current tick and grid.
 * Each step can scale velocity, add timing offset, and gate emission by probability.
 * When `precise` mode is active, groove is bypassed and notes pass through unmodified.
 *
 * Step index: `floor(tick / grid) % steps.length`. Timing offset in ticks:
 * `round(step.timing * grid)`.
 *
 * Extends {@link CompositionBridgeDecorator}. Immutable.
 *
 * @example
 * ```ts
 * // Swing-like: odd steps delayed, even steps on grid
 * groove([
 *   { velocity: 1, timing: 0, probability: 1 },
 *   { velocity: 1, timing: 0.1, probability: 1 },
 * ], 480).steps(note('C4'), note('C4'))
 * ```
 *
 * @example
 * ```ts
 * // Accent pattern with some steps dropped
 * groove([
 *   { velocity: 1.2, timing: 0, probability: 1 },
 *   { velocity: 0.8, timing: 0, probability: 0.7 },
 * ], 240)
 * ```
 */
export class GrooveBridge extends CompositionBridgeDecorator {
  /**
   * @param bridge - Inner bridge to delegate to
   * @param params - Groove steps, grid, and RNG
   */
  constructor(bridge: CompositionBridge, private readonly params: GrooveBridgeParams) {
    super(bridge)
  }

  /**
   * Apply groove step for current tick: optionally skip by probability, scale
   * velocity, then offset tick before emitting.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in ticks; defaults to `defaultDuration`
   * @param velocity - Optional velocity override (still scaled by step.velocity)
   * @returns New bridge state wrapping the updated inner bridge
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) {
      return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
    }

    const stepIndex = Math.floor(this.tick / this.params.grid) % this.params.steps.length
    const step = this.params.steps[stepIndex]

    if (step.probability < 1.0 && !this.params.rng.bool(step.probability)) {
      return this.rewrap(
        this.bridge.withTick(this.tick + (duration ?? this.defaultDuration)),
      )
    }

    const vel = Math.round((velocity ?? this.velocity) * step.velocity)
    const tickOffset = Math.round(step.timing * this.params.grid)

    return this.rewrap(
      this.bridge
        .withTick(this.tick + tickOffset)
        .withNote(pitch, duration, vel),
    )
  }

  /** @internal Preserves groove params when re-wrapping. */
  protected rewrap(bridge: CompositionBridge): GrooveBridge {
    return new GrooveBridge(bridge, this.params)
  }
}
