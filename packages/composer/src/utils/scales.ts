import { ScaleMode } from '../types';

/**
 * Scale intervals for degree-to-pitch conversion.
 * Shared across SynapticMelody and SynapticMelodyNoteCursor.
 * Deeply frozen for immutability.
 * NONE uses major intervals as fallback (never used for degree resolution).
 */
export const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = Object.freeze({
    [ScaleMode.NONE]: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
    [ScaleMode.MAJOR]: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
    [ScaleMode.MINOR]: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
    [ScaleMode.DORIAN]: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
    [ScaleMode.PHRYGIAN]: Object.freeze([0, 1, 3, 5, 7, 8, 10]),
    [ScaleMode.LYDIAN]: Object.freeze([0, 2, 4, 6, 7, 9, 11]),
    [ScaleMode.MIXOLYDIAN]: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
    [ScaleMode.LOCRIAN]: Object.freeze([0, 1, 3, 5, 6, 8, 10])
});
