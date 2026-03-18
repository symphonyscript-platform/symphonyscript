/**
 * A temperament: array of 12 cent offsets from the root (C = 0).
 */
export type Temperament = readonly number[]

/** Named temperament presets. */
export type TemperamentName = 'equal' | 'just' | 'pythagorean' | 'meantone'
