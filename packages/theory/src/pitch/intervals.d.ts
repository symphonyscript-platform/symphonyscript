/**
 * RFC-047: Interval Theory Functions
 *
 * Zero-allocation interval utilities for music theory operations.
 * All functions use pure arithmetic - no objects or arrays allocated.
 *
 * KERNEL-SAFE: All functions are zero-allocation.
 */
/**
 * Interval quality type.
 * P = Perfect (unison, 4th, 5th, octave)
 * M = Major (2nd, 3rd, 6th, 7th)
 * m = minor (2nd, 3rd, 6th, 7th)
 * A = Augmented (any interval raised by semitone)
 * d = diminished (any interval lowered by semitone)
 */
export type IntervalQuality = 'P' | 'M' | 'm' | 'A' | 'd';
/**
 * Get the quality of an interval given semitones and generic interval.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * Generic intervals:
 * - 1 = unison, 2 = second, 3 = third, 4 = fourth
 * - 5 = fifth, 6 = sixth, 7 = seventh, 8 = octave
 *
 * Perfect intervals (1, 4, 5, 8): can be P, A, or d
 * Major/minor intervals (2, 3, 6, 7): can be M, m, A, or d
 *
 * @param semitones - Number of semitones in the interval (0-12)
 * @param generic - Generic interval number (1-8)
 * @returns Interval quality: 'P', 'M', 'm', 'A', or 'd'
 */
export declare function getIntervalQuality(semitones: number, generic: number): IntervalQuality;
/**
 * Invert an interval (complement within an octave).
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * The inversion of an interval is what remains to complete an octave.
 * E.g., P5 (7 semitones) inverts to P4 (5 semitones): 12 - 7 = 5
 *
 * @param semitones - Number of semitones in the interval
 * @returns Inverted interval in semitones (0-11)
 */
export declare function invertInterval(semitones: number): number;
/**
 * Check if two pitches are enharmonically equivalent.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * Two pitches are enharmonic if they have the same pitch class (mod 12).
 * E.g., C# and Db are enharmonic (both pitch class 1).
 *
 * @param a - First pitch (MIDI number or pitch class)
 * @param b - Second pitch (MIDI number or pitch class)
 * @returns true if pitches are enharmonically equivalent
 */
export declare function isEnharmonic(a: number, b: number): boolean;
//# sourceMappingURL=intervals.d.ts.map