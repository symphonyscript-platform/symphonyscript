/**
 * @symphonyscript/theory
 *
 * Music theory primitives: continuous pitch model, MIDI constants,
 * rhythm utilities, voice leading, temperaments, and effects.
 */

// MIDI constants, GM programs, drum map, velocity
export * from './legacy/pitch';

// Rhythm: euclidean patterns, time signature, etc.
export * from './legacy/rhythm';

// Voice leading: voicing algorithms (cent-based)
export * from './legacy/harmony';

// Utility: ratio conversion, misc helpers
export * from './legacy/util';

// Effects: DSP-related theory
export * from './legacy/effects';

// Continuous pitch model: cent-based scales, temperaments, tuning
export * from './legacy/continuous';
