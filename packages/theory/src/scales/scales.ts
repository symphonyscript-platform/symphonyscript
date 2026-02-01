/**
 * RFC-047: Scale Definitions (24-EDO Native)
 *
 * All scales are pre-computed HarmonyMasks for O(1) membership tests.
 * Legacy 12-TET intervals are converted: semitone × 2 = 24-EDO interval.
 *
 * KERNEL-SAFE: isInScale(), quantizeToScale() - zero allocation
 * COMPOSER-ONLY: getScaleIntervals() - allocates array
 */

import type { HarmonyMask, Interval24EDO } from '../types';
import { pack, unpackToArray } from '../packer';
import { INTERVAL, OCTAVE_SIZE } from '../constants';

// Alias for readability
const I = INTERVAL;

// ============================================================================
// SECTION 1: Pre-computed Scale Masks (24-EDO Native)
// ============================================================================

/**
 * Scale definitions as pre-packed HarmonyMasks.
 * Each scale is a bitmask where set bits represent scale degrees.
 */
export const SCALE = {
    // -------------------------------------------------------------------------
    // Diatonic Modes (Church Modes)
    // -------------------------------------------------------------------------
    /** Major (Ionian): W-W-H-W-W-W-H */
    MAJOR: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
    /** Dorian: W-H-W-W-W-H-W */
    DORIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    /** Phrygian: H-W-W-W-H-W-W */
    PHRYGIAN: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    /** Lydian: W-W-W-H-W-W-H */
    LYDIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.TRITONE, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),
    /** Mixolydian: W-W-H-W-W-H-W */
    MIXOLYDIAN: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    /** Natural Minor (Aeolian): W-H-W-W-H-W-W */
    MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    /** Locrian: H-W-W-H-W-W-W */
    LOCRIAN: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.MINOR_SIXTH, I.MINOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Harmonic & Melodic Minor
    // -------------------------------------------------------------------------
    /** Harmonic Minor: W-H-W-W-H-WH-H */
    HARMONIC_MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MAJOR_SEVENTH]),
    /** Melodic Minor (ascending): W-H-W-W-W-W-H */
    MELODIC_MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Pentatonic Scales
    // -------------------------------------------------------------------------
    /** Major Pentatonic: 1-2-3-5-6 */
    PENTATONIC_MAJOR: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SIXTH]),
    /** Minor Pentatonic: 1-b3-4-5-b7 */
    PENTATONIC_MINOR: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    /** Blues Scale: 1-b3-4-b5-5-b7 */
    BLUES: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Symmetric Scales
    // -------------------------------------------------------------------------
    /** Chromatic: All 12 semitones (24-EDO: even intervals only) */
    CHROMATIC: pack([
        I.UNISON, I.MINOR_SECOND, I.MAJOR_SECOND, I.MINOR_THIRD,
        I.MAJOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.PERFECT_FIFTH,
        I.MINOR_SIXTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH, I.MAJOR_SEVENTH,
    ]),
    /** Whole Tone: W-W-W-W-W-W */
    WHOLE_TONE: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.TRITONE, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    /** Diminished Half-Whole: H-W-H-W-H-W-H-W */
    DIMINISHED_HW: pack([I.UNISON, I.MINOR_SECOND, I.MINOR_THIRD, I.MAJOR_THIRD, I.TRITONE, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH]),
    /** Diminished Whole-Half: W-H-W-H-W-H-W-H */
    DIMINISHED_WH: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FOURTH, I.TRITONE, I.MINOR_SIXTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Bebop Scales
    // -------------------------------------------------------------------------
    /** Bebop Dominant: Major scale + b7 */
    BEBOP_DOMINANT: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MINOR_SEVENTH, I.MAJOR_SEVENTH]),
    /** Bebop Major: Major scale + #5 */
    BEBOP_MAJOR: pack([I.UNISON, I.MAJOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MAJOR_SIXTH, I.MAJOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // World Scales
    // -------------------------------------------------------------------------
    /** Hirajoshi (Japanese): 1-2-b3-5-b6 */
    HIRAJOSHI: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SIXTH]),
    /** In-Sen (Japanese): 1-b2-4-5-b7 */
    IN_SEN: pack([I.UNISON, I.MINOR_SECOND, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    /** Hungarian Minor: 1-2-b3-#4-5-b6-7 */
    HUNGARIAN_MINOR: pack([I.UNISON, I.MAJOR_SECOND, I.MINOR_THIRD, I.TRITONE, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MAJOR_SEVENTH]),
    /** Phrygian Dominant (Spanish): 1-b2-3-4-5-b6-b7 */
    PHRYGIAN_DOMINANT: pack([I.UNISON, I.MINOR_SECOND, I.MAJOR_THIRD, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
} as const;

// ============================================================================
// SECTION 2: Kernel-Safe Scale Functions
// ============================================================================

/**
 * Zero-allocation scale membership test.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @param interval - Interval to test (24-EDO, 0-23)
 * @returns true if interval is in scale
 */
export function isInScale(scaleMask: HarmonyMask, interval: number): boolean {
    const normalized = ((interval % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
    return (scaleMask & (1 << normalized)) !== 0;
}

/**
 * Zero-allocation: quantize interval to nearest scale degree.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * Searches outward from the input interval to find the nearest
 * scale degree. Prefers lower intervals on ties.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @param interval - Interval to quantize (24-EDO)
 * @returns Nearest scale degree (0-23)
 */
export function quantizeToScale(scaleMask: HarmonyMask, interval: number): number {
    const normalized = ((interval % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;

    // Check if already in scale
    if ((scaleMask & (1 << normalized)) !== 0) {
        return normalized;
    }

    // Search outward for nearest scale degree
    for (let offset = 1; offset <= 12; offset++) {
        const below = ((normalized - offset) % OCTAVE_SIZE + OCTAVE_SIZE) % OCTAVE_SIZE;
        const above = (normalized + offset) % OCTAVE_SIZE;

        // Prefer lower interval on ties (check below first)
        if ((scaleMask & (1 << below)) !== 0) return below;
        if ((scaleMask & (1 << above)) !== 0) return above;
    }

    // Fallback (shouldn't happen with valid scale)
    return normalized;
}

// ============================================================================
// SECTION 3: Composer-Only Scale Functions
// ============================================================================

/**
 * Get all intervals in scale as array.
 * COMPOSER-ONLY: Allocates array. Do not use in Audio Worklet.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @returns Array of Interval24EDO values
 */
export function getScaleIntervals(scaleMask: HarmonyMask): Interval24EDO[] {
    return unpackToArray(scaleMask);
}

/**
 * Count number of notes in scale.
 * KERNEL-SAFE: Uses bitwise population count.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @returns Number of scale degrees
 */
export function getScaleSize(scaleMask: HarmonyMask): number {
    let count = 0;
    let remaining = scaleMask & 0xFFFFFF;

    while (remaining !== 0) {
        remaining &= (remaining - 1);
        count++;
    }

    return count;
}
