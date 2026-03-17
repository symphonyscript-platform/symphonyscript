export interface ScaleModeRegistry {}
export interface PitchClassRegistry {}
export interface DegreeRegistry {}
export interface KeyContextRegistry {}

export type ScaleMode = ScaleModeRegistry[keyof ScaleModeRegistry]
export type PitchClass = PitchClassRegistry[keyof PitchClassRegistry]
export type Degree = DegreeRegistry[keyof DegreeRegistry]
