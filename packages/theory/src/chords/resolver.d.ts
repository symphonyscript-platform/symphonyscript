/**
 * RFC-047: Chord Resolver (24-EDO Native)
 *
 * Parse chord codes and resolve them to note names.
 * Uses existing CHORD_MAP from definitions.ts.
 */
import type { HarmonyMask } from '../types';
import type { NoteName } from '../pitch/notes';
/**
 * Parsed chord components.
 */
export interface ParsedChord {
    /** Root note (e.g., "C", "F#", "Bb") */
    readonly root: string;
    /** Chord quality/suffix (e.g., "m7", "maj7", "") */
    readonly quality: string;
    /** Intervals in 12-TET semitones from root */
    readonly intervals: readonly number[];
    /** Original chord mask (24-EDO) */
    readonly mask: HarmonyMask;
}
/**
 * Check if a string is a valid chord root.
 * KERNEL-SAFE: Pure check.
 *
 * @param root - String to check
 * @returns True if valid root
 */
export declare function isChordRoot(root: string): boolean;
/**
 * Parse a chord code into its components.
 * COMPOSER-ONLY: String parsing, returns null instead of throw.
 *
 * @param code - Chord code (e.g., "Cmaj7", "F#m", "Bb7")
 * @returns ParsedChord or null if invalid
 */
export declare function parseChordCode(code: string): ParsedChord | null;
/**
 * Get the quality name for a chord suffix.
 * COMPOSER-ONLY: Lookup function.
 *
 * @param suffix - Chord suffix
 * @returns Human-readable quality name or null
 */
export declare function getChordQualityName(suffix: string): string | null;
/**
 * Resolve a chord code to specific note names.
 * COMPOSER-ONLY: String parsing and allocation.
 *
 * @param code - Chord code (e.g., "Cmaj7", "F#m")
 * @param octave - Base octave for the root note
 * @returns Array of NoteName or null if invalid
 */
export declare function chordToNotes(code: string, octave: number): NoteName[] | null;
/**
 * Resolve a chord code to MIDI note numbers.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code (e.g., "Cmaj7")
 * @param octave - Base octave for the root note
 * @returns Array of MIDI numbers or null if invalid
 */
export declare function chordToMidi(code: string, octave: number): number[] | null;
/**
 * Get all supported chord suffixes.
 * COMPOSER-ONLY: Creates array.
 *
 * @returns Array of supported chord suffixes
 */
export declare function getSupportedChordSuffixes(): string[];
/**
 * Check if a chord code is valid.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code to check
 * @returns True if valid
 */
export declare function isValidChordCode(code: string): boolean;
/**
 * Get the interval count for a chord.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code
 * @returns Number of notes in chord, or null if invalid
 */
export declare function getChordSize(code: string): number | null;
//# sourceMappingURL=resolver.d.ts.map