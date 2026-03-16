import  { PitchClass, resolveScaleMode, ScaleMode, ScaleModeName } from '@symphonyscript/theory'
import { resolveTemperament, type TemperamentName } from '@symphonyscript/theory'
import { FieldSetter } from '../builders/SetterBuilders'
import { assertPositive, assertRange } from '../utils/validate'
import { resolveDuration, type NoteDuration } from '../utils/duration'

/**
 * Set transposition in semitones for all subsequent notes (or scoped).
 *
 * Positive = up, negative = down. Use {@link octaveUp} / {@link octaveDown} for
 * octave shifts.
 *
 * @param semitones - Transposition in semitones. Can be negative.

 * @returns {@link FieldSetter} — chain `.steps()` for scoped use or `.default()` to cascade.
 *
 * @example
 * ```ts
 * transpose(12).steps(note('C4'))    // C4 → C5, scoped
 * transpose(-5).default()            // All downstream down 5 semitones
 * ```
 */
export function transpose(semitones: number): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(semitones),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/**
 * Set default velocity for all subsequent notes (or scoped).
 *
 * Velocity (0–1000). 1000 = full.
 *
 * @param value - Velocity (0–1000).

 * @returns {@link FieldSetter}
 * @throws When `value` is outside 0–1000
 */
export function velocity(value: number): FieldSetter {
  assertRange('velocity', value, 0, 1000)
  return new FieldSetter(
    b => b.withVelocity(value),
    (r, p) => r.withVelocity(p.velocity),
  )
}

/**
 * Set tempo in BPM (or scoped).
 *
 * @param bpm - Beats per minute. Must be positive.

 * @returns {@link FieldSetter}
 * @throws When `bpm` ≤ 0
 */
export function tempo(bpm: number): FieldSetter {
  assertPositive('tempo', bpm)
  return new FieldSetter(
    b => b.withTempo(bpm),
    (r, p) => r.withTempo(p.tempo),
  )
}

/**
 * Set scale context for degree-based notation (or scoped).
 *
 * Used by {@link degree} and {@link degreeChord} to resolve scale degrees.
 *
 * @param root - Scale root as {@link PitchClass} (e.g. `'C'`, `'F#'`).
 * @param mode - Scale mode as {@link ScaleMode} enum or string (e.g. `'major'`, `'dor'`, `'pent min'`).

 * @returns {@link FieldSetter}
 *
 * @example
 * ```ts
 * scale('C', 'major').steps(degree(1), degree(3), degree(5))
 * scale('D', 'min').default()
 * ```
 */
export function scale(root: PitchClass, mode: ScaleMode | ScaleModeName): FieldSetter {
  const resolved = resolveScaleMode(mode)
  return new FieldSetter(
    b => b.withScale(root, resolved),
    (r, p) => r.withScale(p.scaleRoot, p.scaleMode),
  )
}

/**
 * Set channel volume (CC7). Emits CC and tracks state for restore in scoped mode.
 *
 * @param value - CC value (0–127).

 * @returns {@link FieldSetter}
 * @throws When `value` is outside 0–127
 */
export function volume(value: number): FieldSetter {
  assertRange('volume', value, 0, 127)
  return new FieldSetter(
    b => b.withVolume(value),
    (r, p) => r.withVolume(p.volume),
  )
}

/**
 * Set pan position (CC10). Emits CC and tracks state for restore in scoped mode.
 *
 * 0 = full left, 64 = center, 127 = full right.
 *
 * @param value - CC value (0–127).

 * @returns {@link FieldSetter}
 * @throws When `value` is outside 0–127
 */
export function pan(value: number): FieldSetter {
  assertRange('pan', value, 0, 127)
  return new FieldSetter(
    b => b.withPan(value),
    (r, p) => r.withPan(p.pan),
  )
}

/**
 * Set key signature context for automatic accidentals (or scoped).
 *
 * Affects how pitches are resolved for key-aware notation (e.g. preferring
 * diatonic spellings).
 *
 * @param root - Key root as {@link PitchClass}.
 * @param mode - Key mode as {@link ScaleMode} enum or string (e.g. `'major'`, `'min'`).

 * @returns {@link FieldSetter}
 */
export function key(root: PitchClass, mode: ScaleMode | ScaleModeName): FieldSetter {
  const resolved = resolveScaleMode(mode)
  return new FieldSetter(
    b => b.withKey(root, resolved),
    (r, p) => p.keyRoot !== null ? r.withKey(p.keyRoot, p.keyMode) : r,
  )
}

/**
 * Set default duration for notes that don't specify one (or scoped).
 *
 * Accepts string notation (`'4n'`, `'8n.'`, `'4t'`) or tick count.
 *
 * @param d - Duration as string or ticks. Must resolve to positive.

 * @returns {@link FieldSetter}
 * @throws When resolved duration ≤ 0
 */
export function duration(d: NoteDuration): FieldSetter {
  const ticks = resolveDuration(d)
  assertPositive('duration', ticks)
  return new FieldSetter(
    b => b.withDefaultDuration(ticks),
    (r, p) => r.withDefaultDuration(p.defaultDuration),
  )
}

/**
 * Set time signature (or scoped).
 *
 * @param numerator - Beats per bar (e.g. 4 for 4/4).
 * @param denominator - Beat unit (e.g. 4 for quarter note).

 * @returns {@link FieldSetter}
 * @throws When `numerator` or `denominator` ≤ 0
 */
export function timeSignature(numerator: number, denominator: number): FieldSetter {
  assertPositive('timeSignature numerator', numerator)
  assertPositive('timeSignature denominator', denominator)
  return new FieldSetter(
    b => b.withTimeSignature(numerator, denominator),
    (r, p) => r.withTimeSignature(p.timeSignatureNum, p.timeSignatureDen),
  )
}

/**
 * Set octave via transpose. Octave 4 = neutral (no transpose).
 *
 * @param n - Octave number (e.g. 4 = C4, 5 = C5). Transpose = (n - 4) * 12.

 * @returns {@link FieldSetter}
 */
export function octave(n: number): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose((n - 4) * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/**
 * Shift up by n octaves. In scoped mode, restores parent transpose after.
 *
 * @param n - Number of octaves to shift up. Default 1.

 * @returns {@link FieldSetter}
 *
 * @example
 * ```ts
 * octaveUp(1).steps(note('C4'))   // C5
 * octaveUp(2).default()           // All downstream up 2 octaves
 * ```
 */
export function octaveUp(n: number = 1): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(b.transpose + n * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/**
 * Shift down by n octaves. In scoped mode, restores parent transpose after.
 *
 * @param n - Number of octaves to shift down. Default 1.

 * @returns {@link FieldSetter}
 */
export function octaveDown(n: number = 1): FieldSetter {
  return new FieldSetter(
    b => b.withTranspose(b.transpose - n * 12),
    (r, p) => r.withTranspose(p.transpose),
  )
}

/**
 * Enable precise mode — skip humanization (or scoped).
 *
 * Notes and events use exact timing without swing or micro-timing variation.
 *
 * @returns {@link FieldSetter}
 */
export function precise(): FieldSetter {
  return new FieldSetter(
    b => b.withPrecise(true),
    (r, p) => r.withPrecise(p.precise),
  )
}

// === RFC-060: Continuous Pitch Cues ===

/**
 * Set tuning reference frequency in Hz (or scoped).
 *
 * Default: 440 Hz (A4). The composer never uses this internally —
 * all math is in cents. The value passes through to the synthesis edge.
 *
 * @param hz - Reference frequency in Hz. Must be positive.
 *
 * @returns {@link FieldSetter}
 * @throws When `hz` ≤ 0
 *
 * @example
 * ```ts
 * tuning(432).steps(note('A4'))     // A4 = 432 Hz, scoped
 * tuning(415).default()             // Baroque pitch downstream
 * ```
 */
export function tuning(hz: number): FieldSetter {
  assertPositive('tuning', hz)
  return new FieldSetter(
    b => b.withTuningHz(hz),
    (r, p) => r.withTuningHz(p.tuningHz),
  )
}

/**
 * Set temperament for note-name resolution (or scoped).
 *
 * Accepts a named preset (`'equal'`, `'just'`, `'pythagorean'`, `'meantone'`)
 * or a custom cent array. Affects how note names map to cent intervals.
 *
 * @param input - Preset name or custom 12-tone cent array.
 *
 * @returns {@link FieldSetter}
 *
 * @example
 * ```ts
 * temperament('just').steps(note('E4'))          // E4 = 5186.31 cents
 * temperament([0, 112, 204, 316, 386, 498, 590, 702, 814, 884, 996, 1088]).default()
 * ```
 */
export function temperament(input: TemperamentName | readonly number[]): FieldSetter {
  const resolved = resolveTemperament(input)
  return new FieldSetter(
    b => b.withTemperament(resolved),
    (r, p) => r.withTemperament(p.temperament),
  )
}
