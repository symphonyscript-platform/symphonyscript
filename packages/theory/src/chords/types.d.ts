/**
 * RFC-047: Chord Helper Types (24-EDO Native)
 *
 * Type definitions for chord manipulation and construction.
 */
/**
 * Valid chord root notes.
 */
export type ChordRoot = 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B';
/**
 * Valid chord suffixes.
 */
export type ChordSuffix = '' | 'm' | '7' | 'maj7' | 'm7' | 'dim' | 'aug' | 'sus4' | 'sus2' | '5' | 'dim7' | 'm7b5' | '9' | 'maj9' | 'm9' | 'add9' | '6' | 'm6' | '11' | '13';
/**
 * Chord quality categories.
 */
export type ChordQuality = 'major' | 'minor' | 'diminished' | 'augmented' | 'dominant' | 'suspended';
/**
 * Complete chord code (root + suffix).
 */
export type ChordCode = `${ChordRoot}${ChordSuffix}`;
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
/**
 * All valid chord roots.
 * KERNEL-SAFE: Frozen array.
 */
export declare const CHORD_ROOTS: readonly ChordRoot[];
/**
 * All valid chord suffixes.
 * KERNEL-SAFE: Frozen array.
 */
export declare const CHORD_SUFFIXES: readonly ChordSuffix[];
/**
 * Check if a string is a valid chord root (type guard).
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid ChordRoot
 */
export declare function isValidChordRoot(value: string): value is ChordRoot;
/**
 * Check if a string is a valid chord suffix.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid ChordSuffix
 */
export declare function isChordSuffix(value: string): value is ChordSuffix;
//# sourceMappingURL=types.d.ts.map