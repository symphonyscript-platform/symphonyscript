import type { PipeStep } from '@symphonyscript/composer'
import { LoopBuilder } from '../builders/LoopBuilder'

/**
 * Repeat a single step N times sequentially.
 *
 * Shorthand for `loop(count, source)` — creates a {@link LoopBuilder} with one
 * step and the given count. Bridge state accumulates across iterations.
 *
 * @param count - Number of repetitions (≥ 1).
 * @param source - Single {@link PipeStep} to repeat (note, chord, clip, etc.).

 * @returns Immutable {@link LoopBuilder} equivalent to `loop(count, source)`.
 *
 * @example
 * ```ts
 * repeat(3, note('C4'))       // C4 three times
 * repeat(4, chord('Am'))      // Am chord four times
 * repeat(2, use(melodyClip))  // Clip twice
 * ```
 */
export function repeat(count: number, source: PipeStep): LoopBuilder {
  return new LoopBuilder({ count, pipeSteps: [source] })
}
