import { PipeStep, step } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'

/**
 * Sustain pedal on (CC64 = 127).
 *
 * Holds currently sounding notes. Pair with {@link release} to end the sustain.
 *
 * @returns {@link PipeStep} emitting sustain-on.
 *
 * @example
 * ```ts
 * sustain().then(note('C4')).then(release())
 * ```
 */
export function sustain(): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.SUSTAIN, 127))
}

/**
 * Sustain pedal off (CC64 = 0).
 *
 * Releases the sustain pedal. Use after {@link sustain} to end held notes.
 *
 * @returns {@link PipeStep} emitting sustain-off.
 *
 * @example
 * ```ts
 * sustain().then(note('C4')).then(release())
 * ```
 */
export function release(): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.SUSTAIN, 0))
}

/**
 * Breath controller (CC2). Useful for wind instruments and expression.
 *
 * @param amount - CC value (0–127).
 * @returns {@link PipeStep} emitting CC2.
 */
export function breath(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.BREATH, amount))
}

/**
 * Expression controller (CC11). Overall dynamics/volume.
 *
 * @param amount - CC value (0–127).
 * @returns {@link PipeStep} emitting CC11.
 */
export function expression(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.EXPRESSION, amount))
}

/**
 * Mod wheel (CC1). Typically controls vibrato depth or filter.
 *
 * @param amount - CC value (0–127).
 * @returns {@link PipeStep} emitting CC1.
 */
export function modWheel(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.MODULATION, amount))
}

/**
 * Reset pitch bend to center (bend = 0).
 *
 * Clears any active pitch bend on the channel.
 *
 * @returns {@link PipeStep} emitting bend reset.
 */
export function bendReset(): PipeStep {
  return step((bridge) => bridge.withBend(0))
}

