/**
 * RFC-047: Chord Helper Types (24-EDO Native)
 *
 * Type definitions for chord manipulation and construction.
 */

// ============================================================================
// SECTION 1: Root and Suffix Types
// ============================================================================

/**
 * Valid chord root notes.
 */
export type ChordRoot =
    | 'C' | 'C#' | 'Db'
    | 'D' | 'D#' | 'Eb'
    | 'E'
    | 'F' | 'F#' | 'Gb'
    | 'G' | 'G#' | 'Ab'
    | 'A' | 'A#' | 'Bb'
    | 'B';

/**
 * Valid chord suffixes.
 */
export type ChordSuffix =
    | ''        // Major
    | 'm'       // Minor
    | '7'       // Dominant 7th
    | 'maj7'    // Major 7th
    | 'm7'      // Minor 7th
    | 'dim'     // Diminished
    | 'aug'     // Augmented
    | 'sus4'    // Suspended 4th
    | 'sus2'    // Suspended 2nd
    | '5'       // Power chord
    | 'dim7'    // Diminished 7th
    | 'm7b5'    // Half-diminished
    | '9'       // Dominant 9th
    | 'maj9'    // Major 9th
    | 'm9'      // Minor 9th
    | 'add9'    // Add 9
    | '6'       // Major 6th
    | 'm6'      // Minor 6th
    | '11'      // Dominant 11th
    | '13';     // Dominant 13th

/**
 * Chord quality categories.
 */
export type ChordQuality =
    | 'major'
    | 'minor'
    | 'diminished'
    | 'augmented'
    | 'dominant'
    | 'suspended';

/**
 * Complete chord code (root + suffix).
 */
export type ChordCode = `${ChordRoot}${ChordSuffix}`;

// ============================================================================
// SECTION 2: Chord Definition Interfaces
// ============================================================================

/**
 * Chord definition with intervals.
 */
export interface ChordDefinition {
    /** Display name (e.g., "Major 7th") */
    readonly name: string;
    /** Chord suffix (e.g., "maj7") */
    readonly suffix: string;
    /** Intervals from root in semitones */
    readonly intervals: readonly number[];
}

/**
 * Options for chord voicing and inversion.
 */
export interface ChordOptions {
    /** Inversion number (0 = root position, 1 = first inversion, etc.) */
    readonly inversion?: number;
    /** Voicing style */
    readonly voicing?: 'close' | 'open' | 'drop2';
}

// ============================================================================
// SECTION 3: Chord Validation
// ============================================================================

/**
 * All valid chord roots.
 * KERNEL-SAFE: Frozen array.
 */
export const CHORD_ROOTS: readonly ChordRoot[] = Object.freeze([
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
    'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
]);

/**
 * All valid chord suffixes.
 * KERNEL-SAFE: Frozen array.
 */
export const CHORD_SUFFIXES: readonly ChordSuffix[] = Object.freeze([
    '', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus4', 'sus2', '5',
    'dim7', 'm7b5', '9', 'maj9', 'm9', 'add9', '6', 'm6', '11', '13'
]);

/**
 * Check if a string is a valid chord root (type guard).
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check

 * @returns True if valid ChordRoot
 */
export function isValidChordRoot(value: string): value is ChordRoot {
    return CHORD_ROOTS.includes(value as ChordRoot);
}

/**
 * Check if a string is a valid chord suffix.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check

 * @returns True if valid ChordSuffix
 */
export function isChordSuffix(value: string): value is ChordSuffix {
    return CHORD_SUFFIXES.includes(value as ChordSuffix);
}
