/**
 * RFC-047: Chord Definitions (24-EDO Native)
 *
 * All chords are pre-computed HarmonyMasks for O(1) operations.
 * Legacy 12-TET intervals are converted: semitone × 2 = 24-EDO interval.
 *
 * KERNEL-SAFE: All constants are frozen primitives.
 *
 * NOTE: CHORD_MAP (symbol lookup) and getChordMask() have been deleted.
 * Use CHORD_INTERVALS_MAP from @symphonyscript/notations instead.
 */

import type { HarmonyMask } from '../types';
import { pack } from '../packer';
import { INTERVAL } from '../constants';

// Alias for readability
const I = INTERVAL;

// ============================================================================
// SECTION 1: Pre-computed Chord Masks (24-EDO Native)
// ============================================================================

/**
 * Chord definitions as pre-packed HarmonyMasks.
 * Each chord is a bitmask where set bits represent intervals from root.
 */
export const CHORD = {
    // -------------------------------------------------------------------------
    // Major Family
    // -------------------------------------------------------------------------
    /** Major Triad: 1-3-5 */
    MAJ: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH]),
    /** Major Seventh: 1-3-5-7 */
    MAJ7: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SEVENTH]),
    /** Major Sixth: 1-3-5-6 */
    MAJ6: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SIXTH]),
    /** Six-Nine: 1-3-5-6-9 */
    SIX_NINE: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SIXTH, I.MAJOR_SECOND]),
    /** Major Ninth: 1-3-5-7-9 */
    MAJ9: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SEVENTH, I.MAJOR_SECOND]),
    /** Major Eleventh: 1-3-5-7-9-11 */
    MAJ11: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SEVENTH, I.MAJOR_SECOND, I.PERFECT_FOURTH]),
    /** Major Thirteenth: 1-3-5-7-9-11-13 */
    MAJ13: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SEVENTH, I.MAJOR_SECOND, I.PERFECT_FOURTH, I.MAJOR_SIXTH]),
    /** Add Nine: 1-3-5-9 */
    ADD9: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SECOND]),

    // -------------------------------------------------------------------------
    // Minor Family
    // -------------------------------------------------------------------------
    /** Minor Triad: 1-b3-5 */
    MIN: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH]),
    /** Minor Seventh: 1-b3-5-b7 */
    MIN7: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    /** Minor Sixth: 1-b3-5-6 */
    MIN6: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SIXTH]),
    /** Minor Ninth: 1-b3-5-b7-9 */
    MIN9: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND]),
    /** Minor Eleventh: 1-b3-5-b7-9-11 */
    MIN11: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND, I.PERFECT_FOURTH]),
    /** Minor Thirteenth: 1-b3-5-b7-9-11-13 */
    MIN13: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND, I.PERFECT_FOURTH, I.MAJOR_SIXTH]),
    /** Minor Major Seventh: 1-b3-5-7 */
    MIN_MAJ7: pack([I.UNISON, I.MINOR_THIRD, I.PERFECT_FIFTH, I.MAJOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Dominant Family
    // -------------------------------------------------------------------------
    /** Dominant Seventh: 1-3-5-b7 */
    DOM7: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    /** Dominant Ninth: 1-3-5-b7-9 */
    DOM9: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND]),
    /** Dominant Eleventh: 1-3-5-b7-9-11 */
    DOM11: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND, I.PERFECT_FOURTH]),
    /** Dominant Thirteenth: 1-3-5-b7-9-13 */
    DOM13: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND, I.MAJOR_SIXTH]),
    /** Seven Sus Four: 1-4-5-b7 */
    DOM7_SUS4: pack([I.UNISON, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SEVENTH]),
    /** Nine Sus Four: 1-4-5-b7-9 */
    DOM9_SUS4: pack([I.UNISON, I.PERFECT_FOURTH, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MAJOR_SECOND]),

    // -------------------------------------------------------------------------
    // Suspended
    // -------------------------------------------------------------------------
    /** Suspended Fourth: 1-4-5 */
    SUS4: pack([I.UNISON, I.PERFECT_FOURTH, I.PERFECT_FIFTH]),
    /** Suspended Second: 1-2-5 */
    SUS2: pack([I.UNISON, I.MAJOR_SECOND, I.PERFECT_FIFTH]),

    // -------------------------------------------------------------------------
    // Power
    // -------------------------------------------------------------------------
    /** Power Chord: 1-5 */
    POWER: pack([I.UNISON, I.PERFECT_FIFTH]),

    // -------------------------------------------------------------------------
    // Diminished Family
    // -------------------------------------------------------------------------
    /** Diminished Triad: 1-b3-b5 */
    DIM: pack([I.UNISON, I.MINOR_THIRD, I.TRITONE]),
    /** Diminished Seventh: 1-b3-b5-bb7 (bb7 = M6 enharmonic) */
    DIM7: pack([I.UNISON, I.MINOR_THIRD, I.TRITONE, I.MAJOR_SIXTH]),
    /** Half-Diminished (m7b5): 1-b3-b5-b7 */
    HALF_DIM: pack([I.UNISON, I.MINOR_THIRD, I.TRITONE, I.MINOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Augmented Family
    // -------------------------------------------------------------------------
    /** Augmented Triad: 1-3-#5 */
    AUG: pack([I.UNISON, I.MAJOR_THIRD, I.MINOR_SIXTH]),
    /** Augmented Seventh: 1-3-#5-b7 */
    AUG7: pack([I.UNISON, I.MAJOR_THIRD, I.MINOR_SIXTH, I.MINOR_SEVENTH]),
    /** Augmented Major Seventh: 1-3-#5-7 */
    AUG_MAJ7: pack([I.UNISON, I.MAJOR_THIRD, I.MINOR_SIXTH, I.MAJOR_SEVENTH]),

    // -------------------------------------------------------------------------
    // Altered Dominants
    // -------------------------------------------------------------------------
    /** Seven Flat Nine: 1-3-5-b7-b9 */
    DOM7_B9: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MINOR_SECOND]),
    /** Seven Sharp Nine: 1-3-5-b7-#9 */
    DOM7_SHARP9: pack([I.UNISON, I.MAJOR_THIRD, I.PERFECT_FIFTH, I.MINOR_SEVENTH, I.MINOR_THIRD]),
    /** Seven Flat Five: 1-3-b5-b7 */
    DOM7_B5: pack([I.UNISON, I.MAJOR_THIRD, I.TRITONE, I.MINOR_SEVENTH]),
    /** Altered Dominant: 1-3-b5-b7-b9-#9-b13 */
    DOM7_ALT: pack([
        I.UNISON,
        I.MAJOR_THIRD,
        I.TRITONE,
        I.MINOR_SEVENTH,
        I.MINOR_SECOND,
        I.MINOR_THIRD,
        I.MINOR_SIXTH,
    ]),
} as const;
