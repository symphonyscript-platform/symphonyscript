import { PipeStep, step } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'

/** Sustain pedal on (CC64 = 127). */
export function sustain(): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.SUSTAIN, 127))
}

/** Sustain pedal off (CC64 = 0). */
export function release(): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.SUSTAIN, 0))
}

/** Breath controller (CC2). Amount 0–127. */
export function breath(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.BREATH, amount))
}

/** Expression controller (CC11). Amount 0–127. */
export function expression(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.EXPRESSION, amount))
}

/** Mod wheel (CC1). Amount 0–127. */
export function modWheel(amount: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.MODULATION, amount))
}

/** Reset pitch bend to center (0). */
export function bendReset(): PipeStep {
  return step((bridge) => bridge.withBend(0))
}
