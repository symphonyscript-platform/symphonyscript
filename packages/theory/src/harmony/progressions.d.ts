/**
 * RFC-047: Chord Progressions (24-EDO Native)
 *
 * Roman numeral parsing and chord progression utilities.
 * Returns HarmonyMask instead of string chord codes.
 */
import type { HarmonyMask, Interval24EDO } from '../types';
/**
 * Key context for chord resolution.
 */
export interface KeyContext {
    /** Root pitch class in 24-EDO (0, 2, 4, ... 22 for C, C#, D, ...) */
    readonly root: Interval24EDO;
    /** Mode: major or minor */
    readonly mode: 'major' | 'minor';
}
/**
 * Parsed roman numeral components.
 */
export interface ParsedNumeral {
    /** Scale degree (1-7) */
    readonly degree: number;
    /** Chord quality suffix */
    readonly quality: string;
    /** Accidental offset: -1 for flat, +1 for sharp */
    readonly accidental?: -1 | 1;
    /** Secondary target degree (for V/V, etc.) */
    readonly secondary?: number;
    /** Bass degree for inversions (I/3, etc.) */
    readonly bass?: number;
}
/**
 * Parse a roman numeral string into degree and quality.
 * COMPOSER-ONLY: String parsing.
 *
 * Supports:
 * - Basic: I, ii, V7, viidim
 * - Modal interchange: bVII, bIII, #IV
 * - Secondary dominants: V/V, V7/ii
 * - Inversions: I/3, I/5
 *
 * @param numeral - Roman numeral string
 * @param mode - Key mode for default qualities
 * @returns ParsedNumeral or null if invalid
 */
export declare function parseRomanNumeral(numeral: string, mode: 'major' | 'minor'): ParsedNumeral | null;
/**
 * Get the interval for a scale degree in a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @returns 24-EDO interval from key root
 */
export declare function getDegreeInterval(degree: number, key: KeyContext): Interval24EDO;
/**
 * Get chord mask for a scale degree.
 * KERNEL-SAFE: Pure bitwise operations.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @param quality - Optional quality override
 * @returns Transposed chord mask
 */
export declare function degreeToMask(degree: number, key: KeyContext, quality?: string): HarmonyMask;
/**
 * Convert roman numeral to chord mask in key.
 * COMPOSER-ONLY: String parsing + mask lookup.
 *
 * @param numeral - Roman numeral string
 * @param key - Key context
 * @returns Chord mask or null if invalid
 */
export declare function romanToMask(numeral: string, key: KeyContext): HarmonyMask | null;
/**
 * Convert progression array to chord masks.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param numerals - Array of roman numerals
 * @param key - Key context
 * @returns Array of chord masks (null entries for invalid numerals)
 */
export declare function progressionToMasks(numerals: readonly string[], key: KeyContext): (HarmonyMask | null)[];
/**
 * Common chord progression presets.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const PROGRESSION: {
    /** Pop: I - V - vi - IV */
    readonly POP: readonly string[];
    /** 12-Bar Blues */
    readonly BLUES_12: readonly string[];
    /** Jazz ii-V-I */
    readonly JAZZ_II_V_I: readonly string[];
    /** Jazz Turnaround */
    readonly JAZZ_TURNAROUND: readonly string[];
    /** Andalusian Cadence */
    readonly ANDALUSIAN: readonly string[];
    /** 50s Progression */
    readonly FIFTIES: readonly string[];
    /** Pachelbel Canon */
    readonly PACHELBEL: readonly string[];
    /** Axis of Awesome (same as POP but different order) */
    readonly AXIS: readonly string[];
    /** Royal Road (Japanese pop) */
    readonly ROYAL_ROAD: readonly string[];
    /** Sensitive Female Chord Progression */
    readonly SENSITIVE: readonly string[];
};
/**
 * Create a key context from a root pitch class.
 * KERNEL-SAFE: Pure construction.
 *
 * @param root - Root pitch class (0-22, even numbers for standard notes)
 * @param mode - Major or minor
 * @returns KeyContext
 */
export declare function createKey(root: Interval24EDO, mode: 'major' | 'minor'): KeyContext;
/**
 * Common key roots in 24-EDO.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const KEY_ROOT: {
    readonly C: Interval24EDO;
    readonly Cs: Interval24EDO;
    readonly Db: Interval24EDO;
    readonly D: Interval24EDO;
    readonly Ds: Interval24EDO;
    readonly Eb: Interval24EDO;
    readonly E: Interval24EDO;
    readonly F: Interval24EDO;
    readonly Fs: Interval24EDO;
    readonly Gb: Interval24EDO;
    readonly G: Interval24EDO;
    readonly Gs: Interval24EDO;
    readonly Ab: Interval24EDO;
    readonly A: Interval24EDO;
    readonly As: Interval24EDO;
    readonly Bb: Interval24EDO;
    readonly B: Interval24EDO;
};
/**
 * Get the root note string for a scale degree in a key.
 * COMPOSER-ONLY: String creation.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @param accidentalOffset - Semitone offset for modal interchange (-1 or +1)
 * @returns Root note string (e.g., "G", "F#", "Bb") or null if invalid
 */
export declare function degreeToRoot(degree: number, key: KeyContext, accidentalOffset?: number): string | null;
/**
 * Convert a roman numeral to a chord code string in a key.
 * COMPOSER-ONLY: String parsing and creation.
 *
 * @param numeral - Roman numeral (e.g., "V7", "bVII", "ii")
 * @param key - Key context
 * @returns Chord code string (e.g., "G7", "Bb", "Dm") or null if invalid
 */
export declare function romanToChord(numeral: string, key: KeyContext): string | null;
/**
 * Convert multiple roman numerals to chord code strings.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param numerals - Array of roman numerals
 * @param key - Key context
 * @returns Array of chord code strings (null entries for invalid numerals)
 */
export declare function progressionToChords(numerals: readonly string[], key: KeyContext): (string | null)[];
/**
 * Get the tritone substitute for a root note.
 * KERNEL-SAFE: Pure lookup, no allocation.
 *
 * The tritone substitute is the root 6 semitones (tritone) away.
 * Jazz convention uses flat notation for substitutes.
 *
 * @param root - Root note name (e.g., 'G', 'C#', 'Bb')
 * @returns Tritone substitute root (e.g., 'Db', 'G', 'E')
 */
export declare function tritoneSubstitute(root: string): string;
/**
 * Apply tritone substitutions to a chord progression.
 * COMPOSER-ONLY: Allocates new array.
 *
 * Only dominant 7th chords (e.g., G7, D7) are substituted.
 * Other chord types (maj7, m7, dim7, etc.) are left unchanged.
 *
 * @param chords - Array of chord symbols
 * @returns New array with dominant 7th chords substituted
 */
export declare function applyTritoneSubstitutions(chords: string[]): string[];
//# sourceMappingURL=progressions.d.ts.map