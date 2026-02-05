/**
 * RFC-047: Pitch Utilities (24-EDO Native)
 *
 * Utilities for converting between MIDI, 24-EDO pitch classes,
 * and interval names.
 *
 * KERNEL-SAFE: All functions are zero-allocation except getIntervalName().
 */
import type { Interval24EDO } from '../types';
/**
 * Convert MIDI note number to 24-EDO pitch class.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * MIDI semitone × 2 = 24-EDO interval (no quarter tones from MIDI).
 * Result is always an even number (0, 2, 4, ..., 22).
 *
 * @param midi - MIDI note number (0-127)
 * @returns 24-EDO pitch class (0-22, even only)
 */
export declare function midiToPitchClass24(midi: number): Interval24EDO;
/**
 * Convert 24-EDO pitch class to MIDI semitone (pitch class).
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * Rounds down: quarter tones become their natural counterpart.
 * E.g., C+ (1) → C (0), E+ (9) → E (4)
 *
 * @param interval - 24-EDO interval (0-23)
 * @returns MIDI pitch class (0-11)
 */
export declare function pitchClass24ToMidi(interval: Interval24EDO): number;
/**
 * Convert 24-EDO interval to frequency ratio.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * @param interval - 24-EDO interval (0-23)
 * @returns Frequency ratio (1.0 for unison, 2.0 for octave)
 */
export declare function intervalToFrequencyRatio(interval: Interval24EDO): number;
/**
 * Convert frequency ratio to nearest 24-EDO interval.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * @param ratio - Frequency ratio (e.g., 1.5 for perfect fifth)
 * @returns Nearest 24-EDO interval (0-23)
 */
export declare function frequencyRatioToInterval(ratio: number): Interval24EDO;
/**
 * Check if 24-EDO interval is a quarter tone.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * Quarter tones are odd-numbered intervals (1, 3, 5, ..., 23).
 * Standard semitones are even-numbered (0, 2, 4, ..., 22).
 *
 * @param interval - 24-EDO interval
 * @returns true if interval is a quarter tone (odd)
 */
export declare function isQuarterTone(interval: Interval24EDO): boolean;
/**
 * Round quarter tone to nearest semitone.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * Rounds down: C+ → C, E+ → E, etc.
 *
 * @param interval - 24-EDO interval
 * @returns Nearest semitone (even interval)
 */
export declare function roundToSemitone(interval: Interval24EDO): Interval24EDO;
/**
 * Get interval name (24-EDO aware).
 * COMPOSER-ONLY: Returns string (allocation).
 *
 * @param interval - 24-EDO interval
 * @returns Interval name (e.g., 'P1', 'M3', 'P5', 'M3+')
 */
export declare function getIntervalName(interval: Interval24EDO): string;
/**
 * Parse interval name to 24-EDO interval.
 * COMPOSER-ONLY: String parsing (allocation).
 *
 * @param name - Interval name (e.g., 'M3', 'P5', 'm7+')
 * @returns 24-EDO interval or undefined if invalid
 */
export declare function parseIntervalName(name: string): Interval24EDO | undefined;
/**
 * Get pitch class name (24-EDO aware).
 * COMPOSER-ONLY: Returns string.
 *
 * @param interval - 24-EDO pitch class (0-23)
 * @returns Pitch class name (e.g., 'C', 'E', 'G', 'C+')
 */
export declare function getPitchClassName(interval: Interval24EDO): string;
//# sourceMappingURL=pitch.d.ts.map