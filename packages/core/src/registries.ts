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
