import { PipeStep, step } from '@symphonyscript/composer'
import type { PitchClass, ScaleMode } from '@symphonyscript/theory'
import {
  TransposeBuilder,
  VelocityBuilder,
  TempoBuilder,
  DefaultDurationBuilder,
  TimeSignatureBuilder,
  ScaleBuilder,
  PreciseBuilder,
  OctaveBuilder,
  VolumeBuilder,
  PanBuilder,
} from '../builders/SetterBuilders'

/** Set transposition for all subsequent notes (or scoped). */
export function transpose(semitones: number): TransposeBuilder {
  return new TransposeBuilder(semitones)
}

/** Set default velocity for all subsequent notes (or scoped). */
export function velocity(value: number): VelocityBuilder {
  return new VelocityBuilder(value)
}

/** Set tempo in BPM (or scoped). */
export function tempo(bpm: number): TempoBuilder {
  return new TempoBuilder(bpm)
}

/** Set scale context for degree-based notation (or scoped). */
export function scale(root: PitchClass, mode: ScaleMode): ScaleBuilder {
  return new ScaleBuilder(root, mode)
}

/** Set channel volume (CC7) (or scoped). */
export function volume(value: number): VolumeBuilder {
  return new VolumeBuilder(value)
}

/** Set pan position (CC10) (or scoped). */
export function pan(value: number): PanBuilder {
  return new PanBuilder(value)
}

/** Set key signature context for automatic accidentals. */
export function key(root: PitchClass, mode: ScaleMode): PipeStep {
  return step((bridge) => bridge.withKey(root, mode))
}

/** Set default duration for notes that don't specify one (or scoped). */
export function defaultDuration(duration: number): DefaultDurationBuilder {
  return new DefaultDurationBuilder(duration)
}

/** Set time signature (or scoped). */
export function timeSignature(numerator: number, denominator: number): TimeSignatureBuilder {
  return new TimeSignatureBuilder(numerator, denominator)
}

/** Set octave via transpose (octave 4 = neutral) (or scoped). */
export function octave(n: number): OctaveBuilder {
  return new OctaveBuilder(n)
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
export function precise(): PreciseBuilder {
  return new PreciseBuilder(true)
}
