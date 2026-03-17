/**
 * @symphonyscript/theory
 * RFC-047: Bitwise Music Theory System (24-EDO Native)
 *
 * NOTE: User-facing notation ergonomics (note names, chord parsing,
 * roman numerals, key signatures, branded MIDI types) have been
 * extracted to @symphonyscript/notations.
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
