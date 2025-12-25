import type { HarmonyMask, Interval24EDO } from './types';
/**
 * RFC-047: Bitwise Packer
 * Zero-allocation conversion between intervals and bitmasks.
 */
/**
 * Packs an array of intervals into a 24-bit integer mask.
 *
 * @param intervals - Array of interval indices (any integer, will be wrapped to 0-23)
 * @returns 32-bit integer with bits set at interval positions
 *
 * @example
 * pack([0, 8, 14]) // Major triad: C, E, G
 * // Returns: 0x4101 (bits 0, 8, 14 set)
 *
 * @example
 * pack([-1]) // Negative wraps to 23 (B+)
 * // Returns: 0x800000
 */
export declare function pack(intervals: readonly number[]): HarmonyMask;
/**
 * Iterates over set bits in a bitmask WITHOUT allocating an array.
 * Uses callback pattern for zero-allocation kernel usage.
 *
 * @param mask - 24-bit integer bitmask
 * @param callback - Function called for each set bit with interval index
 *
 * @example
 * unpack(asHarmonyMask(0x4101), (interval) => {
 *   console.log(interval); // Logs: 0, 8, 14
 * });
 */
export declare function unpack(mask: HarmonyMask, callback: (interval: Interval24EDO) => void): void;
/**
 * Unpacks a bitmask to an array of intervals.
 * WARNING: Allocates memory. Use ONLY in Composer layer, NEVER in Kernel.
 *
 * @param mask - 24-bit integer bitmask
 * @returns Array of interval indices
 */
export declare function unpackToArray(mask: HarmonyMask): Interval24EDO[];
/**
 * Counts the number of set bits in a mask (chord cardinality).
 * Uses Brian Kernighan's algorithm for O(k) where k = number of set bits.
 *
 * @param mask - 24-bit integer bitmask
 * @returns Number of intervals in the harmony
 */
export declare function countBits(mask: HarmonyMask): number;
/**
 * Transposes a bitmask by rotating bits.
 *
 * @param mask - 24-bit integer bitmask
 * @param semitones - Number of semitones to transpose (can be negative)
 * @returns Transposed bitmask
 */
export declare function transpose(mask: HarmonyMask, semitones: number): HarmonyMask;
//# sourceMappingURL=packer.d.ts.map