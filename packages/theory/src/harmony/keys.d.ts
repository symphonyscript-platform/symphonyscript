/**
 * RFC-047: Key Signatures (24-EDO Native)
 *
 * Key signature management using 24-EDO pitch classes.
 * Accidentals are stored as HarmonyMask bitmasks.
 */
import type { HarmonyMask, Interval24EDO } from '../types';
import type { KeyContext } from './progressions';
/**
 * Get the sharps mask for a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context
 * @returns Bitmask of sharped pitch classes
 */
export declare function getKeySharps(key: KeyContext): HarmonyMask;
/**
 * Get the flats mask for a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context
 * @returns Bitmask of flatted pitch classes
 */
export declare function getKeyFlats(key: KeyContext): HarmonyMask;
/**
 * Get combined accidentals mask for a key.
 * KERNEL-SAFE: Pure lookup and bitwise.
 *
 * @param key - Key context
 * @returns Combined bitmask of all accidentals
 */
export declare function getKeyAccidentals(key: KeyContext): HarmonyMask;
/**
 * Check if a key signature is valid.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context
 * @returns True if key is recognized
 */
export declare function isValidKey(key: KeyContext): boolean;
/**
 * Count the number of sharps in a key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param key - Key context
 * @returns Number of sharps (0-7)
 */
export declare function countSharps(key: KeyContext): number;
/**
 * Count the number of flats in a key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param key - Key context
 * @returns Number of flats (0-7)
 */
export declare function countFlats(key: KeyContext): number;
/**
 * Check if a pitch class is sharped in the key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - 24-EDO pitch class
 * @param key - Key context
 * @returns True if pitch class is sharped
 */
export declare function isSharpedInKey(pitchClass: Interval24EDO, key: KeyContext): boolean;
/**
 * Check if a pitch class is flatted in the key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - 24-EDO pitch class
 * @param key - Key context
 * @returns True if pitch class is flatted
 */
export declare function isFlattedInKey(pitchClass: Interval24EDO, key: KeyContext): boolean;
/**
 * Apply key signature to a pitch class.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - Natural pitch class (0, 4, 8, 10, 14, 18, 22)
 * @param key - Key context
 * @returns Adjusted pitch class with key signature applied
 */
export declare function applyKeyToPitchClass(pitchClass: Interval24EDO, key: KeyContext): Interval24EDO;
/**
 * Get the relative minor of a major key.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param majorKey - Major key context
 * @returns Relative minor key context, or null if input is not major
 */
export declare function getRelativeMinor(majorKey: KeyContext): KeyContext | null;
/**
 * Get the relative major of a minor key.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param minorKey - Minor key context
 * @returns Relative major key context, or null if input is not minor
 */
export declare function getRelativeMajor(minorKey: KeyContext): KeyContext | null;
/**
 * Get the parallel minor of a major key.
 * KERNEL-SAFE: Pure construction.
 *
 * @param majorKey - Major key context
 * @returns Parallel minor (same root, minor mode)
 */
export declare function getParallelMinor(majorKey: KeyContext): KeyContext | null;
/**
 * Get the parallel major of a minor key.
 * KERNEL-SAFE: Pure construction.
 *
 * @param minorKey - Minor key context
 * @returns Parallel major (same root, major mode)
 */
export declare function getParallelMajor(minorKey: KeyContext): KeyContext | null;
/**
 * All valid key signatures.
 * KERNEL-SAFE: Frozen array.
 */
export declare const ALL_KEYS: readonly string[];
/**
 * Major keys in circle of fifths order.
 * KERNEL-SAFE: Frozen array.
 */
export declare const MAJOR_KEYS_CIRCLE: readonly string[];
/**
 * Minor keys in circle of fifths order.
 * KERNEL-SAFE: Frozen array.
 */
export declare const MINOR_KEYS_CIRCLE: readonly string[];
/**
 * Accidental override type.
 */
export type AccidentalOverride = 'sharp' | 'flat' | 'natural';
/**
 * Apply key signature accidentals to a note name.
 * COMPOSER-ONLY: String manipulation.
 *
 * @param noteName - Note name (e.g., "F4")
 * @param key - Key context (or null for no key)
 * @param overrideAccidental - Explicit accidental ('sharp', 'flat', 'natural')
 * @returns Modified note name (e.g., "F#4" in G major), or null if invalid
 */
export declare function applyKeySignature(noteName: string, key: KeyContext | null, overrideAccidental?: AccidentalOverride): string | null;
//# sourceMappingURL=keys.d.ts.map