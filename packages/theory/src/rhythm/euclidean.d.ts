/**
 * RFC-047: Euclidean Rhythm Generator (24-EDO Native)
 *
 * Bjorklund's algorithm for generating evenly-distributed rhythmic patterns.
 * Includes kernel-safe bitmask variants for real-time audio processing.
 */
import type { HarmonyMask } from '../types';
/**
 * Bjorklund's algorithm for Euclidean rhythms.
 * Distributes k pulses evenly over n steps.
 *
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param hits - Number of pulses (k)
 * @param steps - Total steps (n)
 * @returns Boolean array where true = hit, or null if invalid input
 */
export declare function euclidean(hits: number, steps: number): boolean[] | null;
/**
 * Euclidean rhythm as bitmask.
 * KERNEL-SAFE: Returns primitive after initial computation.
 *
 * @param hits - Number of pulses
 * @param steps - Total steps (max 24)
 * @returns Bitmask where set bits = hits, or null if invalid
 */
export declare function euclideanMask(hits: number, steps: number): HarmonyMask | null;
/**
 * Kernel-safe Euclidean iteration.
 * KERNEL-SAFE: Uses callback, no allocation after mask computation.
 *
 * @param hits - Number of pulses
 * @param steps - Total steps
 * @param callback - Called for each hit position
 */
export declare function euclideanForEach(hits: number, steps: number, callback: (step: number) => void): void;
/**
 * Rotate pattern by offset steps.
 * Positive = rotate right, Negative = rotate left.
 *
 * COMPOSER-ONLY: Allocates new array.
 *
 * @param pattern - Boolean pattern array
 * @param offset - Steps to rotate
 * @returns Rotated pattern
 */
export declare function rotatePattern(pattern: boolean[], offset: number): boolean[];
/**
 * Rotate bitmask pattern.
 * KERNEL-SAFE: Pure bitwise operations.
 *
 * @param mask - Rhythm bitmask
 * @param offset - Steps to rotate
 * @param steps - Total pattern length (for wrapping)
 * @returns Rotated bitmask
 */
export declare function rotateMask(mask: HarmonyMask, offset: number, steps: number): HarmonyMask;
/**
 * Convert boolean pattern to string visualization.
 * COMPOSER-ONLY: String allocation.
 *
 * @param pattern - Boolean pattern array
 * @param hitChar - Character for hits (default 'x')
 * @param restChar - Character for rests (default '-')
 * @returns String visualization
 */
export declare function patternToString(pattern: boolean[], hitChar?: string, restChar?: string): string;
//# sourceMappingURL=euclidean.d.ts.map