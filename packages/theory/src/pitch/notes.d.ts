/**
 * RFC-047: Note Name Utilities (24-EDO Native)
 *
 * Note name types, validation, and factory functions.
 * Provides type-safe note name handling with branded types.
 */
/**
 * Pitch class names (without octave).
 */
export type Pitch = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B' | 'C#' | 'D#' | 'F#' | 'G#' | 'A#' | 'Db' | 'Eb' | 'Gb' | 'Ab' | 'Bb';
/**
 * Branded type symbol for validated note names.
 */
declare const NoteNameBrand: unique symbol;
/**
 * Branded note name type for runtime-validated strings.
 */
export type BrandedNoteName = string & {
    readonly [NoteNameBrand]: never;
};
/**
 * Literal note name type (pitch + octave).
 */
export type LiteralNoteName = `${Pitch}${number}`;
/**
 * Note name type - either literal or branded.
 */
export type NoteName = LiteralNoteName | BrandedNoteName;
/**
 * Check if a string is a valid note name.
 * KERNEL-SAFE: Pure regex check, no allocation.
 *
 * @param value - String to check
 * @returns True if value is a valid NoteName
 */
export declare function isNoteName(value: string): value is NoteName;
/**
 * Create a validated NoteName from a string.
 * COMPOSER-ONLY: Returns null instead of throwing.
 *
 * @param value - String to validate
 * @returns NoteName if valid, null otherwise
 */
export declare function noteName(value: string): NoteName | null;
/**
 * Unsafe cast to NoteName (for internal use only).
 * COMPOSER-ONLY: Use when you've already validated the string.
 *
 * @param value - String to cast (must be pre-validated)
 * @returns NoteName (unchecked)
 */
export declare function unsafeNoteName(value: string): NoteName;
/**
 * Factory functions for creating note names.
 * COMPOSER-ONLY: Creates string allocations.
 *
 * Usage:
 * ```typescript
 * Notes.C(4)  // "C4"
 * Notes.Fs(3) // "F#3"
 * Notes.Bb(5) // "Bb5"
 * ```
 */
export declare const Notes: {
    /** Create C note at octave */
    readonly C: (octave: number) => NoteName;
    /** Create D note at octave */
    readonly D: (octave: number) => NoteName;
    /** Create E note at octave */
    readonly E: (octave: number) => NoteName;
    /** Create F note at octave */
    readonly F: (octave: number) => NoteName;
    /** Create G note at octave */
    readonly G: (octave: number) => NoteName;
    /** Create A note at octave */
    readonly A: (octave: number) => NoteName;
    /** Create B note at octave */
    readonly B: (octave: number) => NoteName;
    /** Create C# note at octave */
    readonly Cs: (octave: number) => NoteName;
    /** Create D# note at octave */
    readonly Ds: (octave: number) => NoteName;
    /** Create F# note at octave */
    readonly Fs: (octave: number) => NoteName;
    /** Create G# note at octave */
    readonly Gs: (octave: number) => NoteName;
    /** Create A# note at octave */
    readonly As: (octave: number) => NoteName;
    /** Create Db note at octave */
    readonly Db: (octave: number) => NoteName;
    /** Create Eb note at octave */
    readonly Eb: (octave: number) => NoteName;
    /** Create Gb note at octave */
    readonly Gb: (octave: number) => NoteName;
    /** Create Ab note at octave */
    readonly Ab: (octave: number) => NoteName;
    /** Create Bb note at octave */
    readonly Bb: (octave: number) => NoteName;
};
/**
 * Parsed note name components.
 */
export interface ParsedNoteName {
    /** Pitch class (e.g., "C", "F#", "Bb") */
    readonly pitch: string;
    /** Octave number */
    readonly octave: number;
}
/**
 * Parse a note name into pitch and octave.
 * COMPOSER-ONLY: String parsing.
 *
 * @param note - Note name string
 * @returns ParsedNoteName or null if invalid
 */
export declare function parseNoteName(note: string): ParsedNoteName | null;
/**
 * Create a note name from pitch and octave.
 * COMPOSER-ONLY: String creation.
 *
 * @param pitch - Pitch class (e.g., "C", "F#")
 * @param octave - Octave number
 * @returns NoteName or null if invalid pitch
 */
export declare function createNoteName(pitch: string, octave: number): NoteName | null;
/**
 * All valid pitch class names.
 * KERNEL-SAFE: Frozen array.
 */
export declare const PITCH_CLASSES: readonly string[];
/**
 * Check if a string is a valid pitch class.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid pitch class
 */
export declare function isPitchClass(value: string): value is Pitch;
export {};
//# sourceMappingURL=notes.d.ts.map