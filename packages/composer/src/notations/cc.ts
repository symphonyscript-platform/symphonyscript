import { PipeStep, step } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'

/**
 * Emit a MIDI Control Change at the current tick.
 *
 * Sends a single CC event via the bridge without advancing the tick. Use for
 * modulation, expression, or any CC-based parameter.
 *
 * @param controller - CC number (0–127). See {@link MIDI_CC} for common controllers.
 * @param value - CC value (0–127).
 * @returns {@link PipeStep} that applies the CC when run.
 *
 * @example
 * ```ts
 * cc(64, 127)           // Sustain pedal on
 * cc(MIDI_CC.MODULATION, 64)  // Mod wheel halfway
 * ```
 */
export function cc(controller: number, value: number): PipeStep {
  return step((bridge) => bridge.withCC(controller, value))
}

/**
 * Modulation wheel (CC1). Amount 0–127.
 *
 * @param value - Mod wheel value (0–127).
 * @returns {@link PipeStep} emitting CC1.
 */
export function detune(value: number): PipeStep {
  return cc(MIDI_CC.MODULATION, value)
}

/**
 * Brightness / filter cutoff (CC74). Amount 0–127.
 *
 * @param value - Brightness value (0–127).
 * @returns {@link PipeStep} emitting CC74.
 */
export function timbre(value: number): PipeStep {
  return cc(MIDI_CC.BRIGHTNESS, value)
}

/**
 * Effect control 2 / channel pressure (CC13). Amount 0–127.
 *
 * @param value - Pressure value (0–127).
 * @returns {@link PipeStep} emitting CC13.
 */
export function pressure(value: number): PipeStep {
  return cc(MIDI_CC.EFFECT_2, value)
}
