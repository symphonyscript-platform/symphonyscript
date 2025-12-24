import { MASK_24_BIT, OCTAVE_SIZE } from './constants';
import type { HarmonyMask, Interval24EDO } from './types';
import { asHarmonyMask, asInterval24EDO } from './types';

/**
 * RFC-047: Bitwise Packer
 * Zero-allocation conversion between intervals and bitmasks.
 */

// ============================================================================
// PACK: Array → Int32
// ============================================================================

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
export function pack(intervals: readonly number[]): HarmonyMask {
    let mask = 0;

    // CRITICAL: No allocation in loop
    for (let i = 0; i < intervals.length; i++) {
        // Correctly handle negative modulo
        const interval = ((intervals[i] % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
        mask |= (1 << interval);  // Set bit
    }

    return asHarmonyMask(mask & MASK_24_BIT);  // Ensure 24-bit boundary
}

// ============================================================================
// UNPACK: Int32 → Iteration (NO ARRAY)
// ============================================================================

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
export function unpack(mask: HarmonyMask, callback: (interval: Interval24EDO) => void): void {
    let remaining = mask & MASK_24_BIT;
    let position = 0;

    // CRITICAL: Bitwise iteration, zero allocation
    while (remaining !== 0) {
        if (remaining & 1) {
            callback(asInterval24EDO(position));
        }
        remaining >>>= 1;  // Unsigned right shift
        position++;
    }
}

// ============================================================================
// UNPACK TO ARRAY (Composer Convenience Only - NOT for Kernel)
// ============================================================================

/**
 * Unpacks a bitmask to an array of intervals.
 * WARNING: Allocates memory. Use ONLY in Composer layer, NEVER in Kernel.
 * 
 * @param mask - 24-bit integer bitmask
 * @returns Array of interval indices
 */
export function unpackToArray(mask: HarmonyMask): Interval24EDO[] {
    const result: Interval24EDO[] = [];
    unpack(mask, (interval) => result.push(interval));
    return result;
}

// ============================================================================
// UTILITY: Count Set Bits (Chord Cardinality)
// ============================================================================

/**
 * Counts the number of set bits in a mask (chord cardinality).
 * Uses Brian Kernighan's algorithm for O(k) where k = number of set bits.
 * 
 * @param mask - 24-bit integer bitmask
 * @returns Number of intervals in the harmony
 */
export function countBits(mask: HarmonyMask): number {
    let count = 0;
    let remaining = mask & MASK_24_BIT;

    while (remaining !== 0) {
        remaining &= (remaining - 1);  // Clear lowest set bit
        count++;
    }

    return count;
}

// ============================================================================
// UTILITY: Transpose (Bitwise Rotation)
// ============================================================================

/**
 * Transposes a bitmask by rotating bits.
 * 
 * @param mask - 24-bit integer bitmask
 * @param semitones - Number of semitones to transpose (can be negative)
 * @returns Transposed bitmask
 */
export function transpose(mask: HarmonyMask, semitones: number): HarmonyMask {
    const shift = ((semitones % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;

    // Rotate left: split at boundary and recombine
    const rotated = ((mask << shift) | (mask >>> (OCTAVE_SIZE - shift))) & MASK_24_BIT;

    return asHarmonyMask(rotated);
}
