/**
 * @symphonyscript/theory
 *
 * Music theory primitives: continuous pitch model, MIDI constants,
 * rhythm utilities, voice leading, temperaments, and effects.
 */

// MIDI constants, GM programs, drum map, velocity
export * from './pitch';

// Rhythm: euclidean patterns, time signature, etc.
export * from './rhythm';

// Voice leading: voicing algorithms (cent-based)
export * from './harmony';

// Utility: ratio conversion, misc helpers
export * from './util';

// Effects: DSP-related theory
export * from './effects';

// Continuous pitch model: cent-based scales, temperaments, tuning
export * from './continuous';
