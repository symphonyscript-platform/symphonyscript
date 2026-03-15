import { PipeStep, step } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'
import type { PitchClass, ScaleMode } from '@symphonyscript/theory'

/** Set transposition for all subsequent notes. */
export function transpose(semitones: number): PipeStep {
  return step((bridge) => bridge.withTranspose(semitones))
}

/** Set default velocity for all subsequent notes. */
export function velocity(value: number): PipeStep {
  return step((bridge) => bridge.withVelocity(value))
}

/** Set tempo in BPM. */
export function tempo(bpm: number): PipeStep {
  return step((bridge) => bridge.withTempo(bpm))
}

/** Set scale context for degree-based notation. */
export function scale(root: PitchClass, mode: ScaleMode): PipeStep {
  return step((bridge) => bridge.withScale(root, mode))
}

/** Set channel volume (CC7). */
export function volume(value: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.VOLUME, value))
}

/** Set pan position (CC10). */
export function pan(value: number): PipeStep {
  return step((bridge) => bridge.withCC(MIDI_CC.PAN, value))
}

/** Set key signature context for automatic accidentals. */
export function key(root: PitchClass, mode: ScaleMode): PipeStep {
  return step((bridge) => bridge.withKey(root, mode))
}

/** Set default duration for notes that don't specify one. */
export function defaultDuration(duration: number): PipeStep {
  return step((bridge) => bridge.withDefaultDuration(duration))
}

/** Set time signature. */
export function timeSignature(numerator: number, denominator: number): PipeStep {
  return step((bridge) => bridge.withTimeSignature(numerator, denominator))
}

/** Set octave via transpose (octave 4 = neutral). */
export function octave(n: number): PipeStep {
  return step((bridge) => bridge.withTranspose((n - 4) * 12))
}

/** Shift up by n octaves. */
export function octaveUp(n: number = 1): PipeStep {
  return step((bridge) => bridge.withTranspose(bridge.transpose + n * 12))
}

/** Shift down by n octaves. */
export function octaveDown(n: number = 1): PipeStep {
  return step((bridge) => bridge.withTranspose(bridge.transpose - n * 12))
}

/** Disable humanization for subsequent notes. */
export function precise(): PipeStep {
  return step((bridge) => bridge.withPrecise(true))
}
