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
 * Perfect interval semitone values for generic intervals 1, 4, 5, 8.
 * Index 0 = unison (0 semitones)
 * Index 1 = perfect 4th (5 semitones)
 * Index 2 = perfect 5th (7 semitones)
 * Index 3 = octave (12 semitones)
 */
const PERFECT_SEMITONES = [0, 5, 7, 12] as const;

/**
 * Major interval semitone values for generic intervals 2, 3, 6, 7.
 * Index 0 = major 2nd (2 semitones)
 * Index 1 = major 3rd (4 semitones)
 * Index 2 = major 6th (9 semitones)
 * Index 3 = major 7th (11 semitones)
 */
const MAJOR_SEMITONES = [2, 4, 9, 11] as const;

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
export function getIntervalQuality(semitones: number, generic: number): IntervalQuality {
    // Normalize semitones to 0-12 range
    const normalizedSemitones = ((semitones % 12) + 12) % 12;
    // Normalize generic to 1-8 range (handle 8 as octave)
    const normalizedGeneric = generic === 8 ? 8 : ((generic - 1) % 7) + 1;

    // Perfect intervals: 1 (unison), 4 (fourth), 5 (fifth), 8 (octave)
    if (normalizedGeneric === 1 || normalizedGeneric === 4 || normalizedGeneric === 5 || normalizedGeneric === 8) {
        let perfectSemitones: number;
        if (normalizedGeneric === 1) perfectSemitones = PERFECT_SEMITONES[0];
        else if (normalizedGeneric === 4) perfectSemitones = PERFECT_SEMITONES[1];
        else if (normalizedGeneric === 5) perfectSemitones = PERFECT_SEMITONES[2];
        else perfectSemitones = PERFECT_SEMITONES[3]; // octave

        // Handle octave case (semitones = 0 or 12)
        if (normalizedGeneric === 8 && normalizedSemitones === 0) {
            return 'P'; // 12 semitones normalized to 0
        }

        const diff = normalizedSemitones - perfectSemitones;
        if (diff === 0) return 'P';
        if (diff === 1 || diff === -11) return 'A';
        if (diff === -1 || diff === 11) return 'd';
        // Doubly augmented/diminished - return closest
        return diff > 0 ? 'A' : 'd';
    }

    // Major/minor intervals: 2, 3, 6, 7
    let majorSemitones: number;
    if (normalizedGeneric === 2) majorSemitones = MAJOR_SEMITONES[0];
    else if (normalizedGeneric === 3) majorSemitones = MAJOR_SEMITONES[1];
    else if (normalizedGeneric === 6) majorSemitones = MAJOR_SEMITONES[2];
    else majorSemitones = MAJOR_SEMITONES[3]; // 7th

    const diff = normalizedSemitones - majorSemitones;
    if (diff === 0) return 'M';
    if (diff === -1) return 'm';
    if (diff === 1) return 'A';
    if (diff === -2) return 'd';
    // Handle edge cases
    return diff > 0 ? 'A' : 'd';
}

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
export function invertInterval(semitones: number): number {
    const normalized = ((semitones % 12) + 12) % 12;
    return (12 - normalized) % 12;
}

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
export function isEnharmonic(a: number, b: number): boolean {
    const pitchClassA = ((a % 12) + 12) % 12;
    const pitchClassB = ((b % 12) + 12) % 12;
    return pitchClassA === pitchClassB;
}
