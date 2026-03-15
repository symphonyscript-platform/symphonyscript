import { PipeStep, step } from '@symphonyscript/composer'
import type { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { MIDI_CC } from '@symphonyscript/theory'
import { FieldSetter } from '../builders/SetterBuilders'

/** Set transposition for all subsequent notes (or scoped). */
export function transpose(semitones: number): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(semitones),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/** Set default velocity for all subsequent notes (or scoped). */
export function velocity(value: number): FieldSetter {
  return new FieldSetter(
    b => b.withVelocity(value),
    (r, p) => r.withVelocity(p.velocity),
  )
}

/** Set tempo in BPM (or scoped). */
export function tempo(bpm: number): FieldSetter {
  return new FieldSetter(
    b => b.withTempo(bpm),
    (r, p) => r.withTempo(p.tempo),
  )
}

/** Set scale context for degree-based notation (or scoped). */
export function scale(root: PitchClass, mode: ScaleMode): FieldSetter {
  return new FieldSetter(
    b => b.withScale(root, mode),
    (r, p) => r.withScale(p.scaleRoot as PitchClass, p.scaleMode),
  )
}

/** Set channel volume (CC7) (or scoped). */
export function volume(value: number): FieldSetter {
  return new FieldSetter(
    b => b.withCC(MIDI_CC.VOLUME, value),
    r => r,
  )
}

/** Set pan position (CC10) (or scoped). */
export function pan(value: number): FieldSetter {
  return new FieldSetter(
    b => b.withCC(MIDI_CC.PAN, value),
    r => r,
  )
}

/** Set key signature context for automatic accidentals. */
export function key(root: PitchClass, mode: ScaleMode): PipeStep {
  return step((bridge) => bridge.withKey(root, mode))
}

/** Set default duration for notes that don't specify one (or scoped). */
export function defaultDuration(duration: number): FieldSetter {
  return new FieldSetter(
    b => b.withDefaultDuration(duration),
    (r, p) => r.withDefaultDuration(p.defaultDuration),
  )
}

/** Set time signature (or scoped). */
export function timeSignature(numerator: number, denominator: number): FieldSetter {
  return new FieldSetter(
    b => b.withTimeSignature(numerator, denominator),
    (r, p) => r.withTimeSignature(p.timeSignatureNum, p.timeSignatureDen),
  )
}

/** Set octave via transpose (octave 4 = neutral) (or scoped). */
export function octave(n: number): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose((n - 4) * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/** Shift up by n octaves. */
export function octaveUp(n: number = 1): PipeStep {
  return step((bridge) => bridge.withTranspose(bridge.transpose + n * 12))
}

/** Shift down by n octaves. */
export function octaveDown(n: number = 1): PipeStep {
  return step((bridge) => bridge.withTranspose(bridge.transpose - n * 12))
}

/** Enable precise mode (skip humanization) (or scoped). */
export function precise(): FieldSetter {
  return new FieldSetter(
    b => b.withPrecise(true),
    (r, p) => r.withPrecise(p.precise),
  )
}
