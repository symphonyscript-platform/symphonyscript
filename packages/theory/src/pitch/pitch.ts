/**
 * RFC-047: Pitch Utilities (24-EDO Native)
 *
 * Utilities for converting between MIDI, 24-EDO pitch classes,
 * and frequency ratios.
 *
 * KERNEL-SAFE: All functions are zero-allocation.
 *
 * NOTE: Interval naming (getIntervalName, parseIntervalName) and
 * pitch class naming (getPitchClassName) have been extracted to
 * @symphonyscript/notations.
 */

import type { Interval24EDO } from '../types';
import { asInterval24EDO } from '../types';
import { OCTAVE_SIZE } from '../constants';

// ============================================================================
// SECTION 1: MIDI Conversion Functions
// ============================================================================

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
export function midiToPitchClass24(midi: number): Interval24EDO {
    const semitone = ((midi % 12) + 12) % 12;
    return asInterval24EDO(semitone * 2);
}

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
export function pitchClass24ToMidi(interval: Interval24EDO): number {
    return Math.floor(Number(interval) / 2);
}

/**
 * Convert 24-EDO interval to frequency ratio.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * @param interval - 24-EDO interval (0-23)

 * @returns Frequency ratio (1.0 for unison, 2.0 for octave)
 */
export function intervalToFrequencyRatio(interval: Interval24EDO): number {
    // Each 24-EDO step = 50 cents = 1/24 of an octave
    return Math.pow(2, Number(interval) / OCTAVE_SIZE);
}

/**
 * Convert frequency ratio to nearest 24-EDO interval.
 * KERNEL-SAFE: No allocation, pure arithmetic.
 *
 * @param ratio - Frequency ratio (e.g., 1.5 for perfect fifth)

 * @returns Nearest 24-EDO interval (0-23)
 */
export function frequencyRatioToInterval(ratio: number): Interval24EDO {
    const cents = 1200 * Math.log2(ratio);
    const steps = Math.round(cents / 50); // 50 cents per 24-EDO step
    const normalized = ((steps % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
    return asInterval24EDO(normalized);
}

// ============================================================================
// SECTION 2: Quarter Tone Detection
// ============================================================================

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
export function isQuarterTone(interval: Interval24EDO): boolean {
    return (Number(interval) & 1) === 1;
}

/**
 * Round quarter tone to nearest semitone.
 * KERNEL-SAFE: No allocation, pure bitwise.
 *
 * Rounds down: C+ → C, E+ → E, etc.
 *
 * @param interval - 24-EDO interval

 * @returns Nearest semitone (even interval)
 */
export function roundToSemitone(interval: Interval24EDO): Interval24EDO {
    return asInterval24EDO(Number(interval) & ~1);
}
