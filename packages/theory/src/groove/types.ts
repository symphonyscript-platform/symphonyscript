/**
 * Individual step in a groove pattern.
 */
export interface GrooveStep {
  /** Timing offset as ratio of step duration (-1.0 to 1.0) */
  readonly timing?: number
  /** Velocity multiplier (0.0 to 2.0) */
  readonly velocity?: number
  /** Duration multiplier (0.0 to 2.0) */
  readonly duration?: number
}

/**
 * Groove template for micro-timing adjustments.
 */
export interface GrooveTemplate {
  readonly name: string
  readonly stepsPerBeat: number
  readonly steps: readonly GrooveStep[]
}
