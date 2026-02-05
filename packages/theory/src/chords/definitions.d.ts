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
/**
 * Chord definitions as pre-packed HarmonyMasks.
 * Each chord is a bitmask where set bits represent intervals from root.
 */
export declare const CHORD: {
    /** Major Triad: 1-3-5 */
    readonly MAJ: HarmonyMask;
    /** Major Seventh: 1-3-5-7 */
    readonly MAJ7: HarmonyMask;
    /** Major Sixth: 1-3-5-6 */
    readonly MAJ6: HarmonyMask;
    /** Six-Nine: 1-3-5-6-9 */
    readonly SIX_NINE: HarmonyMask;
    /** Major Ninth: 1-3-5-7-9 */
    readonly MAJ9: HarmonyMask;
    /** Major Eleventh: 1-3-5-7-9-11 */
    readonly MAJ11: HarmonyMask;
    /** Major Thirteenth: 1-3-5-7-9-11-13 */
    readonly MAJ13: HarmonyMask;
    /** Add Nine: 1-3-5-9 */
    readonly ADD9: HarmonyMask;
    /** Minor Triad: 1-b3-5 */
    readonly MIN: HarmonyMask;
    /** Minor Seventh: 1-b3-5-b7 */
    readonly MIN7: HarmonyMask;
    /** Minor Sixth: 1-b3-5-6 */
    readonly MIN6: HarmonyMask;
    /** Minor Ninth: 1-b3-5-b7-9 */
    readonly MIN9: HarmonyMask;
    /** Minor Eleventh: 1-b3-5-b7-9-11 */
    readonly MIN11: HarmonyMask;
    /** Minor Thirteenth: 1-b3-5-b7-9-11-13 */
    readonly MIN13: HarmonyMask;
    /** Minor Major Seventh: 1-b3-5-7 */
    readonly MIN_MAJ7: HarmonyMask;
    /** Dominant Seventh: 1-3-5-b7 */
    readonly DOM7: HarmonyMask;
    /** Dominant Ninth: 1-3-5-b7-9 */
    readonly DOM9: HarmonyMask;
    /** Dominant Eleventh: 1-3-5-b7-9-11 */
    readonly DOM11: HarmonyMask;
    /** Dominant Thirteenth: 1-3-5-b7-9-13 */
    readonly DOM13: HarmonyMask;
    /** Seven Sus Four: 1-4-5-b7 */
    readonly DOM7_SUS4: HarmonyMask;
    /** Nine Sus Four: 1-4-5-b7-9 */
    readonly DOM9_SUS4: HarmonyMask;
    /** Suspended Fourth: 1-4-5 */
    readonly SUS4: HarmonyMask;
    /** Suspended Second: 1-2-5 */
    readonly SUS2: HarmonyMask;
    /** Power Chord: 1-5 */
    readonly POWER: HarmonyMask;
    /** Diminished Triad: 1-b3-b5 */
    readonly DIM: HarmonyMask;
    /** Diminished Seventh: 1-b3-b5-bb7 (bb7 = M6 enharmonic) */
    readonly DIM7: HarmonyMask;
    /** Half-Diminished (m7b5): 1-b3-b5-b7 */
    readonly HALF_DIM: HarmonyMask;
    /** Augmented Triad: 1-3-#5 */
    readonly AUG: HarmonyMask;
    /** Augmented Seventh: 1-3-#5-b7 */
    readonly AUG7: HarmonyMask;
    /** Augmented Major Seventh: 1-3-#5-7 */
    readonly AUG_MAJ7: HarmonyMask;
    /** Seven Flat Nine: 1-3-5-b7-b9 */
    readonly DOM7_B9: HarmonyMask;
    /** Seven Sharp Nine: 1-3-5-b7-#9 */
    readonly DOM7_SHARP9: HarmonyMask;
    /** Seven Flat Five: 1-3-b5-b7 */
    readonly DOM7_B5: HarmonyMask;
    /** Altered Dominant: 1-3-b5-b7-b9-#9-b13 */
    readonly DOM7_ALT: HarmonyMask;
};
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
export declare const CHORD_MAP: ReadonlyMap<string, HarmonyMask>;
/**
 * Get chord mask by symbol.
 * COMPOSER-ONLY: Wrapper around CHORD_MAP.get().
 *
 * @param symbol - Chord symbol (e.g., 'm7', 'maj7', '7')
 * @returns HarmonyMask or undefined if not found
 */
export declare function getChordMask(symbol: string): HarmonyMask | undefined;
//# sourceMappingURL=definitions.d.ts.map