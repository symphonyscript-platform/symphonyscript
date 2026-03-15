import { PipeStep, step } from '@symphonyscript/composer'

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
export function scale(root: number, mode: number): PipeStep {
  return step((bridge) => bridge.withScale(root, mode))
}
