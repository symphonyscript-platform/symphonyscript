/**
 * RFC-047: Interval & Pitch Class Naming (24-EDO Native)
 *
 * Interval and pitch class display string utilities.
 * Extracted from theory/src/pitch/pitch.ts §3-4.
 */

import type { Interval24EDO } from '@symphonyscript/theory';
import { OCTAVE_SIZE } from '@symphonyscript/theory';

// ============================================================================
// SECTION 1: Interval Naming
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
    return index as Interval24EDO;
}

// ============================================================================
// SECTION 2: Pitch Class Names
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
