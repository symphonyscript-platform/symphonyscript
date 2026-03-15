import { PipeStep, step } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'

export function cc(controller: number, value: number): PipeStep {
  return step((bridge) => bridge.withCC(controller, value))
}

/** Modulation wheel (CC1). */
export function detune(value: number): PipeStep {
  return cc(MIDI_CC.MODULATION, value)
}

/** Brightness / filter cutoff (CC74). */
export function timbre(value: number): PipeStep {
  return cc(MIDI_CC.BRIGHTNESS, value)
}

/** Effect control 2 / channel pressure (CC13). */
export function pressure(value: number): PipeStep {
  return cc(MIDI_CC.EFFECT_2, value)
}
