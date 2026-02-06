import { ScaleMode } from '../types';

/**
 * Scale intervals for degree-to-pitch conversion.
 * Shared across SynapticMelody and SynapticMelodyNoteCursor.
 * Deeply frozen for immutability.
 */
export const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = Object.freeze({
    major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
    minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
    dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
    phrygian: Object.freeze([0, 1, 3, 5, 7, 8, 10]),
    lydian: Object.freeze([0, 2, 4, 6, 7, 9, 11]),
    mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
    locrian: Object.freeze([0, 1, 3, 5, 6, 8, 10])
});
