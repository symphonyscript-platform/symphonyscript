import type { Interval24EDO } from './types';

/**
 * RFC-047: 24-EDO Interval Constants
 * Grid: 1 Octave = 24 Steps (50 cents each)
 */

// ============================================================================
// SECTION 1: Interval Bit Positions (0-23)
// ============================================================================
export const INTERVAL = {
    // Unison & Quarter Tones
    UNISON: 0 as Interval24EDO,           // P1  - C
    QUARTER_SHARP: 1 as Interval24EDO,    // +   - C+

    // Minor Second
    MINOR_SECOND: 2 as Interval24EDO,     // m2  - Db
    MINOR_SECOND_QS: 3 as Interval24EDO,  // m2+ - Db+

    // Major Second
    MAJOR_SECOND: 4 as Interval24EDO,     // M2  - D
    MAJOR_SECOND_QS: 5 as Interval24EDO,  // M2+ - D+

    // Minor Third
    MINOR_THIRD: 6 as Interval24EDO,      // m3  - Eb
    MINOR_THIRD_QS: 7 as Interval24EDO,   // m3+ - Eb+

    // Major Third
    MAJOR_THIRD: 8 as Interval24EDO,      // M3  - E
    MAJOR_THIRD_QS: 9 as Interval24EDO,   // M3+ - E+

    // Perfect Fourth
    PERFECT_FOURTH: 10 as Interval24EDO,  // P4  - F
    PERFECT_FOURTH_QS: 11 as Interval24EDO, // P4+ - F+

    // Tritone
    TRITONE: 12 as Interval24EDO,         // TT  - F#/Gb
    TRITONE_QS: 13 as Interval24EDO,      // TT+ - F#/Gb+

    // Perfect Fifth
    PERFECT_FIFTH: 14 as Interval24EDO,   // P5  - G
    PERFECT_FIFTH_QS: 15 as Interval24EDO, // P5+ - G+

    // Minor Sixth
    MINOR_SIXTH: 16 as Interval24EDO,     // m6  - Ab
    MINOR_SIXTH_QS: 17 as Interval24EDO,  // m6+ - Ab+

    // Major Sixth
    MAJOR_SIXTH: 18 as Interval24EDO,     // M6  - A
    MAJOR_SIXTH_QS: 19 as Interval24EDO,  // M6+ - A+

    // Minor Seventh
    MINOR_SEVENTH: 20 as Interval24EDO,   // m7  - Bb
    MINOR_SEVENTH_QS: 21 as Interval24EDO, // m7+ - Bb+

    // Major Seventh
    MAJOR_SEVENTH: 22 as Interval24EDO,   // M7  - B
    MAJOR_SEVENTH_QS: 23 as Interval24EDO, // M7+ - B+
} as const;

// ============================================================================
// SECTION 2: Bitmask Utility Constants
// ============================================================================
export const MASK_24_BIT = 0xFFFFFF;  // All 24 bits set
export const OCTAVE_SIZE = 24;         // Number of intervals per octave

// ============================================================================
// SECTION 3: Zero-Allocation Validation
// ============================================================================
// CRITICAL: All exports are primitives or frozen objects.
// No runtime allocations in this module.
