/**
 * RFC-047: Chord Definitions (24-EDO Native)
 *
 * All chords are pre-computed HarmonyMasks for O(1) operations.
 * Legacy 12-TET intervals are converted: semitone × 2 = 24-EDO interval.
 *
 * KERNEL-SAFE: All constants are frozen primitives.
 * COMPOSER-ONLY: CHORD_MAP uses Map for O(1) lookup.
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

// ============================================================================
// SECTION 2: Chord Symbol Lookup Map
// ============================================================================

/**
 * Chord symbol to HarmonyMask lookup.
 * COMPOSER-ONLY: Uses Map for O(1) lookup. Do not use in Audio Worklet.
 *
 * Supports multiple notations per chord:
 * - Major: '', 'maj', 'M'
 * - Minor: 'm', '-', 'min'
 * - Dominant: '7', 'dom7'
 * - etc.
 */
export const CHORD_MAP: ReadonlyMap<string, HarmonyMask> = new Map([
    // Major
    ['', CHORD.MAJ],
    ['maj', CHORD.MAJ],
    ['M', CHORD.MAJ],
    ['maj7', CHORD.MAJ7],
    ['M7', CHORD.MAJ7],
    ['Δ', CHORD.MAJ7],
    ['Δ7', CHORD.MAJ7],
    ['6', CHORD.MAJ6],
    ['M6', CHORD.MAJ6],
    ['6/9', CHORD.SIX_NINE],
    ['69', CHORD.SIX_NINE],
    ['6add9', CHORD.SIX_NINE],
    ['maj9', CHORD.MAJ9],
    ['M9', CHORD.MAJ9],
    ['Δ9', CHORD.MAJ9],
    ['maj11', CHORD.MAJ11],
    ['M11', CHORD.MAJ11],
    ['Δ11', CHORD.MAJ11],
    ['maj13', CHORD.MAJ13],
    ['M13', CHORD.MAJ13],
    ['Δ13', CHORD.MAJ13],
    ['add9', CHORD.ADD9],
    ['add2', CHORD.ADD9],

    // Minor
    ['m', CHORD.MIN],
    ['-', CHORD.MIN],
    ['min', CHORD.MIN],
    ['m7', CHORD.MIN7],
    ['-7', CHORD.MIN7],
    ['min7', CHORD.MIN7],
    ['m6', CHORD.MIN6],
    ['-6', CHORD.MIN6],
    ['min6', CHORD.MIN6],
    ['m9', CHORD.MIN9],
    ['-9', CHORD.MIN9],
    ['min9', CHORD.MIN9],
    ['m11', CHORD.MIN11],
    ['-11', CHORD.MIN11],
    ['min11', CHORD.MIN11],
    ['m13', CHORD.MIN13],
    ['-13', CHORD.MIN13],
    ['min13', CHORD.MIN13],
    ['m(maj7)', CHORD.MIN_MAJ7],
    ['-Δ7', CHORD.MIN_MAJ7],
    ['min(maj7)', CHORD.MIN_MAJ7],
    ['mM7', CHORD.MIN_MAJ7],

    // Dominant
    ['7', CHORD.DOM7],
    ['dom7', CHORD.DOM7],
    ['9', CHORD.DOM9],
    ['dom9', CHORD.DOM9],
    ['11', CHORD.DOM11],
    ['dom11', CHORD.DOM11],
    ['13', CHORD.DOM13],
    ['dom13', CHORD.DOM13],
    ['7sus4', CHORD.DOM7_SUS4],
    ['7sus', CHORD.DOM7_SUS4],
    ['9sus4', CHORD.DOM9_SUS4],
    ['9sus', CHORD.DOM9_SUS4],

    // Suspended
    ['sus4', CHORD.SUS4],
    ['sus', CHORD.SUS4],
    ['sus2', CHORD.SUS2],
    ['2', CHORD.SUS2],

    // Power
    ['5', CHORD.POWER],
    ['(no3)', CHORD.POWER],

    // Diminished
    ['dim', CHORD.DIM],
    ['°', CHORD.DIM],
    ['dim7', CHORD.DIM7],
    ['°7', CHORD.DIM7],
    ['m7b5', CHORD.HALF_DIM],
    ['ø', CHORD.HALF_DIM],
    ['ø7', CHORD.HALF_DIM],

    // Augmented
    ['aug', CHORD.AUG],
    ['+', CHORD.AUG],
    ['aug7', CHORD.AUG7],
    ['+7', CHORD.AUG7],
    ['7#5', CHORD.AUG7],
    ['maj7#5', CHORD.AUG_MAJ7],
    ['Δ+', CHORD.AUG_MAJ7],
    ['Δ#5', CHORD.AUG_MAJ7],

    // Altered
    ['7b9', CHORD.DOM7_B9],
    ['7-9', CHORD.DOM7_B9],
    ['7#9', CHORD.DOM7_SHARP9],
    ['7+9', CHORD.DOM7_SHARP9],
    ['7b5', CHORD.DOM7_B5],
    ['7-5', CHORD.DOM7_B5],
    ['7alt', CHORD.DOM7_ALT],
]);

// ============================================================================
// SECTION 3: Utility Functions
// ============================================================================

/**
 * Get chord mask by symbol.
 * COMPOSER-ONLY: Wrapper around CHORD_MAP.get().
 *
 * @param symbol - Chord symbol (e.g., 'm7', 'maj7', '7')

 * @returns HarmonyMask or undefined if not found
 */
export function getChordMask(symbol: string): HarmonyMask | undefined {
    return CHORD_MAP.get(symbol);
}
