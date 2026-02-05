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
/**
 * Scale definitions as pre-packed HarmonyMasks.
 * Each scale is a bitmask where set bits represent scale degrees.
 */
export declare const SCALE: {
    /** Major (Ionian): W-W-H-W-W-W-H */
    readonly MAJOR: HarmonyMask;
    /** Dorian: W-H-W-W-W-H-W */
    readonly DORIAN: HarmonyMask;
    /** Phrygian: H-W-W-W-H-W-W */
    readonly PHRYGIAN: HarmonyMask;
    /** Lydian: W-W-W-H-W-W-H */
    readonly LYDIAN: HarmonyMask;
    /** Mixolydian: W-W-H-W-W-H-W */
    readonly MIXOLYDIAN: HarmonyMask;
    /** Natural Minor (Aeolian): W-H-W-W-H-W-W */
    readonly MINOR: HarmonyMask;
    /** Locrian: H-W-W-H-W-W-W */
    readonly LOCRIAN: HarmonyMask;
    /** Harmonic Minor: W-H-W-W-H-WH-H */
    readonly HARMONIC_MINOR: HarmonyMask;
    /** Melodic Minor (ascending): W-H-W-W-W-W-H */
    readonly MELODIC_MINOR: HarmonyMask;
    /** Major Pentatonic: 1-2-3-5-6 */
    readonly PENTATONIC_MAJOR: HarmonyMask;
    /** Minor Pentatonic: 1-b3-4-5-b7 */
    readonly PENTATONIC_MINOR: HarmonyMask;
    /** Blues Scale: 1-b3-4-b5-5-b7 */
    readonly BLUES: HarmonyMask;
    /** Chromatic: All 12 semitones (24-EDO: even intervals only) */
    readonly CHROMATIC: HarmonyMask;
    /** Whole Tone: W-W-W-W-W-W */
    readonly WHOLE_TONE: HarmonyMask;
    /** Diminished Half-Whole: H-W-H-W-H-W-H-W */
    readonly DIMINISHED_HW: HarmonyMask;
    /** Diminished Whole-Half: W-H-W-H-W-H-W-H */
    readonly DIMINISHED_WH: HarmonyMask;
    /** Bebop Dominant: Major scale + b7 */
    readonly BEBOP_DOMINANT: HarmonyMask;
    /** Bebop Major: Major scale + #5 */
    readonly BEBOP_MAJOR: HarmonyMask;
    /** Hirajoshi (Japanese): 1-2-b3-5-b6 */
    readonly HIRAJOSHI: HarmonyMask;
    /** In-Sen (Japanese): 1-b2-4-5-b7 */
    readonly IN_SEN: HarmonyMask;
    /** Hungarian Minor: 1-2-b3-#4-5-b6-7 */
    readonly HUNGARIAN_MINOR: HarmonyMask;
    /** Phrygian Dominant (Spanish): 1-b2-3-4-5-b6-b7 */
    readonly PHRYGIAN_DOMINANT: HarmonyMask;
};
/**
 * Zero-allocation scale membership test.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @param interval - Interval to test (24-EDO, 0-23)
 * @returns true if interval is in scale
 */
export declare function isInScale(scaleMask: HarmonyMask, interval: number): boolean;
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
export declare function quantizeToScale(scaleMask: HarmonyMask, interval: number): number;
/**
 * Get all intervals in scale as array.
 * COMPOSER-ONLY: Allocates array. Do not use in Audio Worklet.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @returns Array of Interval24EDO values
 */
export declare function getScaleIntervals(scaleMask: HarmonyMask): Interval24EDO[];
/**
 * Count number of notes in scale.
 * KERNEL-SAFE: Uses bitwise population count.
 *
 * @param scaleMask - Scale as HarmonyMask
 * @returns Number of scale degrees
 */
export declare function getScaleSize(scaleMask: HarmonyMask): number;
//# sourceMappingURL=scales.d.ts.map