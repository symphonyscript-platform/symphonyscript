/**
 * RFC-047: Pitch Utilities (24-EDO Native)
 *
 * Utilities for converting between MIDI, 24-EDO pitch classes,
 * and interval names.
 *
 * KERNEL-SAFE: All functions are zero-allocation except getIntervalName().
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

// ============================================================================
// SECTION 3: Interval Naming
// ============================================================================

/**
 * Interval names for 24-EDO system.
 * Uses standard abbreviations with '+' suffix for quarter-sharp.
 */
const INTERVAL_NAMES: readonly string[] = [
    'P1',   // 0  - Unison
    'P1+',  // 1  - Quarter sharp
    'm2',   // 2  - Minor second
    'm2+',  // 3  - Minor second quarter sharp
    'M2',   // 4  - Major second
    'M2+',  // 5  - Major second quarter sharp
    'm3',   // 6  - Minor third
    'm3+',  // 7  - Minor third quarter sharp
    'M3',   // 8  - Major third
    'M3+',  // 9  - Major third quarter sharp
    'P4',   // 10 - Perfect fourth
    'P4+',  // 11 - Perfect fourth quarter sharp
    'TT',   // 12 - Tritone
    'TT+',  // 13 - Tritone quarter sharp
    'P5',   // 14 - Perfect fifth
    'P5+',  // 15 - Perfect fifth quarter sharp
    'm6',   // 16 - Minor sixth
    'm6+',  // 17 - Minor sixth quarter sharp
    'M6',   // 18 - Major sixth
    'M6+',  // 19 - Major sixth quarter sharp
    'm7',   // 20 - Minor seventh
    'm7+',  // 21 - Minor seventh quarter sharp
    'M7',   // 22 - Major seventh
    'M7+',  // 23 - Major seventh quarter sharp
] as const;

/**
 * Get interval name (24-EDO aware).
 * COMPOSER-ONLY: Returns string (allocation).
 *
 * @param interval - 24-EDO interval

 * @returns Interval name (e.g., 'P1', 'M3', 'P5', 'M3+')
 */
export function getIntervalName(interval: Interval24EDO): string {
    const normalized = ((Number(interval) % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
    return INTERVAL_NAMES[normalized] ?? '?';
}

/**
 * Parse interval name to 24-EDO interval.
 * COMPOSER-ONLY: String parsing (allocation).
 *
 * @param name - Interval name (e.g., 'M3', 'P5', 'm7+')

 * @returns 24-EDO interval or undefined if invalid
 */
export function parseIntervalName(name: string): Interval24EDO | undefined {
    const index = INTERVAL_NAMES.indexOf(name);
    if (index === -1) return undefined;
    return asInterval24EDO(index);
}

// ============================================================================
// SECTION 4: Pitch Class Names
// ============================================================================

/**
 * Note names for 24-EDO system (C-based).
 * Uses '+' suffix for quarter-sharp variants.
 */
const PITCH_CLASS_NAMES: readonly string[] = [
    'C',    // 0
    'C+',   // 1
    'C#',   // 2
    'C#+',  // 3
    'D',    // 4
    'D+',   // 5
    'D#',   // 6
    'D#+',  // 7
    'E',    // 8
    'E+',   // 9
    'F',    // 10
    'F+',   // 11
    'F#',   // 12
    'F#+',  // 13
    'G',    // 14
    'G+',   // 15
    'G#',   // 16
    'G#+',  // 17
    'A',    // 18
    'A+',   // 19
    'A#',   // 20
    'A#+',  // 21
    'B',    // 22
    'B+',   // 23
] as const;

/**
 * Get pitch class name (24-EDO aware).
 * COMPOSER-ONLY: Returns string.
 *
 * @param interval - 24-EDO pitch class (0-23)

 * @returns Pitch class name (e.g., 'C', 'E', 'G', 'C+')
 */
export function getPitchClassName(interval: Interval24EDO): string {
    const normalized = ((Number(interval) % OCTAVE_SIZE) + OCTAVE_SIZE) % OCTAVE_SIZE;
    return PITCH_CLASS_NAMES[normalized] ?? '?';
}
