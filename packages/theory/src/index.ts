/**
 * @symphonyscript/theory
 * RFC-047: Bitwise Music Theory System (24-EDO Native)
 *
 * NOTE: User-facing notation ergonomics (note names, chord parsing,
 * roman numerals, key signatures, branded MIDI types) have been
 * extracted to @symphonyscript/notations.
 *
 * TODO Phase 2: Refactor composer to use cent-based APIs
 * (WesternNotation.degreeToCents, CHORD_INTERVALS_MAP) instead of
 * bitmask APIs (degreeToPitch, CHORD, pack). Once done, delete:
 * - types.ts, constants.ts, packer.ts (bitmask core)
 * - chords/definitions.ts (bitmask CHORD)
 * - scales/ (bitmask SCALE, helpers)
 * - harmony/voiceleading.ts (refactor to cent arrays)
 * - pitch/pitch.ts (24-EDO pitch class utils)
 * Target index.ts: export continuous, pitch, rhythm, harmony, util, effects
 */

// Core Bitwise Architecture
export * from './types';
export * from './constants';
export * from './packer';

// 24-EDO Native Modules
export * from './chords';
export * from './scales';
export * from './pitch';
export * from './rhythm';
export * from './harmony';
export * from './util';
export * from './effects';

// RFC-060: Continuous Pitch Model
export * from './continuous';
