export interface ScaleModeRegistry {}
export interface PitchClassRegistry {}
export interface DegreeRegistry {}
export interface KeyContextRegistry {}
export interface IntervalNameRegistry {}
export interface ChordSymbolRegistry {}
export interface DurationRegistry {}

export type ScaleMode = ScaleModeRegistry[keyof ScaleModeRegistry]
export type PitchClass = PitchClassRegistry[keyof PitchClassRegistry]
export type Degree = DegreeRegistry[keyof DegreeRegistry]
export type IntervalName = IntervalNameRegistry[keyof IntervalNameRegistry]
export type ChordSymbol = ChordSymbolRegistry[keyof ChordSymbolRegistry]
export type DurationName = DurationRegistry[keyof DurationRegistry]

/** Valid octave numbers for note names (C(-1) = 0 cents through C10 = 13200 cents). */
export type Octave = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/**
 * Full note name with octave (e.g., `'C4'`, `'F#3'`, `'Bb5'`).
 * Template literal from `PitchClass × Octave` — resolves to ~252 members
 * when a notation augments `PitchClassRegistry`.
 */
export type NoteName = `${PitchClass}${Octave}`

/**
 * Full chord code with root and quality (e.g., `'Cmaj7'`, `'Am'`, `'F#dim'`).
 * Template literal from `PitchClass × ChordSymbol`.
 */
export type ChordCode = `${PitchClass}${ChordSymbol}`

/**
 * Pitch input for note and chord builders. Accepts either a typed note name
 * (e.g. `'C4'`, `'F#3'`, `'Bb5'`) or absolute cents from C0.
 *
 * String pitches are resolved via `notation.noteToCents()` at apply-time.
 * Numeric pitches are passed through as-is (already in cents).
 */
export type NotePitch = NoteName | number

/**
 * Note duration as a notation duration name or raw tick count.
 *
 * String values (e.g. `'4n'`, `'quarter'`, `'8n.'`) are resolved
 * at apply-time via `bridge.notation().durationToTicks(name, ppq)`.
 * Numbers pass through unchanged as raw tick values.
 */
export type NoteDuration = DurationName | number
