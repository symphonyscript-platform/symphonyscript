import type { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { FieldSetter } from '../builders/SetterBuilders'
import { assertPositive, assertRange } from '../utils/validate'

/** Set transposition for all subsequent notes (or scoped). */
export function transpose(semitones: number): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(semitones),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/** Set default velocity for all subsequent notes (or scoped). */
export function velocity(value: number): FieldSetter {
  assertRange('velocity', value, 0, 1270)
  return new FieldSetter(
    b => b.withVelocity(value),
    (r, p) => r.withVelocity(p.velocity),
  )
}

/** Set tempo in BPM (or scoped). */
export function tempo(bpm: number): FieldSetter {
  assertPositive('tempo', bpm)
  return new FieldSetter(
    b => b.withTempo(bpm),
    (r, p) => r.withTempo(p.tempo),
  )
}

/** Set scale context for degree-based notation (or scoped). */
export function scale(root: PitchClass, mode: ScaleMode): FieldSetter {
  return new FieldSetter(
    b => b.withScale(root, mode),
    (r, p) => r.withScale(p.scaleRoot, p.scaleMode),
  )
}

/** Set channel volume CC7 (or scoped). Emits CC + tracks state for proper restore. */
export function volume(value: number): FieldSetter {
  assertRange('volume', value, 0, 127)
  return new FieldSetter(
    b => b.withVolume(value),
    (r, p) => r.withVolume(p.volume),
  )
}

/** Set pan position CC10 (or scoped). Emits CC + tracks state for proper restore. */
export function pan(value: number): FieldSetter {
  assertRange('pan', value, 0, 127)
  return new FieldSetter(
    b => b.withPan(value),
    (r, p) => r.withPan(p.pan),
  )
}

/** Set key signature context for automatic accidentals (or scoped). */
export function key(root: PitchClass, mode: ScaleMode): FieldSetter {
  return new FieldSetter(
    b => b.withKey(root, mode),
    (r, p) => p.keyRoot !== null ? r.withKey(p.keyRoot, p.keyMode) : r,
  )
}

/** Set default duration for notes that don't specify one (or scoped). */
export function defaultDuration(duration: number): FieldSetter {
  assertPositive('defaultDuration', duration)
  return new FieldSetter(
    b => b.withDefaultDuration(duration),
    (r, p) => r.withDefaultDuration(p.defaultDuration),
  )
}

/** Set time signature (or scoped). */
export function timeSignature(numerator: number, denominator: number): FieldSetter {
  assertPositive('timeSignature numerator', numerator)
  assertPositive('timeSignature denominator', denominator)
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

/** Shift up by n octaves (scoped — restores parent transpose after). */
export function octaveUp(n: number = 1): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(b.transpose + n * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/** Shift down by n octaves (scoped — restores parent transpose after). */
export function octaveDown(n: number = 1): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(b.transpose - n * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/** Set swing amount 0.0–1.0 (or scoped). */
export function swing(amount: number): FieldSetter {
  assertRange('swing', amount, 0, 1)
  return new FieldSetter(
    b => b.withSwing(amount),
    (r, p) => r.withSwing(p.swing),
  )
}

/** Enable precise mode — skip humanization (or scoped). */
export function precise(): FieldSetter {
  return new FieldSetter(
    b => b.withPrecise(true),
    (r, p) => r.withPrecise(p.precise),
  )
}
