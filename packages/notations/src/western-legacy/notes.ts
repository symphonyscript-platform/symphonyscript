/**
 * RFC-047: Note Name Utilities (24-EDO Native)
 *
 * Note name types, validation, and factory functions.
 * Provides type-safe note name handling with branded types.
 */

// ============================================================================
// SECTION 1: Types
// ============================================================================

/**
 * Pitch class names (without octave).
 */
export type Pitch =
    | 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
    | 'C#' | 'D#' | 'F#' | 'G#' | 'A#'
    | 'Db' | 'Eb' | 'Gb' | 'Ab' | 'Bb';

/**
 * Branded type symbol for validated note names.
 */
declare const NoteNameBrand: unique symbol;

/**
 * Branded note name type for runtime-validated strings.
 */
export type BrandedNoteName = string & { readonly [NoteNameBrand]: never };

/**
 * Literal note name type (pitch + octave).
 */
export type LiteralNoteName = `${Pitch}${number}`;

/**
 * Note name type - either literal or branded.
 */
export type NoteName = LiteralNoteName | BrandedNoteName;

// ============================================================================
// SECTION 2: Note Name Validation
// ============================================================================
//
// /**
//  * Regex pattern for valid note names.
//  * Matches: C4, F#3, Bb5, D-1, etc.
//  */
// const NOTE_NAME_PATTERN = /^[A-Ga-g][#b]?-?\d+$/;

// /**
//  * Check if a string is a valid note name.
//  * KERNEL-SAFE: Pure regex check, no allocation.
//  *
//  * @param value - String to check
//
//  * @returns True if value is a valid NoteName
//  */
// export function isNoteName(value: string): value is NoteName {
//     return NOTE_NAME_PATTERN.test(value);
// }

// /**
//  * Create a validated NoteName from a string.
//  * COMPOSER-ONLY: Returns null instead of throwing.
//  *
//  * @param value - String to validate
//
//  * @returns NoteName if valid, null otherwise
//  */
// export function noteName(value: string): NoteName | null {
//     if (!isNoteName(value)) {
//         return null;
//     }
//     return value as NoteName;
// }
//
// /**
//  * Unsafe cast to NoteName (for internal use only).
//  * COMPOSER-ONLY: Use when you've already validated the string.
//  *
//  * @param value - String to cast (must be pre-validated)
//
//  * @returns NoteName (unchecked)
//  */
// export function unsafeNoteName(value: string): NoteName {
//     return value as NoteName;
// }
//
// // ============================================================================
// // SECTION 3: Note Factory Functions
// // ============================================================================
//
// /**
//  * Factory functions for creating note names.
//  * COMPOSER-ONLY: Creates string allocations.
//  *
//  * Usage:
//  * ```typescript
//  * Notes.C(4)  // "C4"
//  * Notes.Fs(3) // "F#3"
//  * Notes.Bb(5) // "Bb5"
//  * ```
//  */
// export const Notes = {
//     // Natural notes
//     /** Create C note at octave */
//     C: (octave: number): NoteName => `C${octave}` as NoteName,
//     /** Create D note at octave */
//     D: (octave: number): NoteName => `D${octave}` as NoteName,
//     /** Create E note at octave */
//     E: (octave: number): NoteName => `E${octave}` as NoteName,
//     /** Create F note at octave */
//     F: (octave: number): NoteName => `F${octave}` as NoteName,
//     /** Create G note at octave */
//     G: (octave: number): NoteName => `G${octave}` as NoteName,
//     /** Create A note at octave */
//     A: (octave: number): NoteName => `A${octave}` as NoteName,
//     /** Create B note at octave */
//     B: (octave: number): NoteName => `B${octave}` as NoteName,
//
//     // Sharps
//     /** Create C# note at octave */
//     Cs: (octave: number): NoteName => `C#${octave}` as NoteName,
//     /** Create D# note at octave */
//     Ds: (octave: number): NoteName => `D#${octave}` as NoteName,
//     /** Create F# note at octave */
//     Fs: (octave: number): NoteName => `F#${octave}` as NoteName,
//     /** Create G# note at octave */
//     Gs: (octave: number): NoteName => `G#${octave}` as NoteName,
//     /** Create A# note at octave */
//     As: (octave: number): NoteName => `A#${octave}` as NoteName,
//
//     // Flats
//     /** Create Db note at octave */
//     Db: (octave: number): NoteName => `Db${octave}` as NoteName,
//     /** Create Eb note at octave */
//     Eb: (octave: number): NoteName => `Eb${octave}` as NoteName,
//     /** Create Gb note at octave */
//     Gb: (octave: number): NoteName => `Gb${octave}` as NoteName,
//     /** Create Ab note at octave */
//     Ab: (octave: number): NoteName => `Ab${octave}` as NoteName,
//     /** Create Bb note at octave */
//     Bb: (octave: number): NoteName => `Bb${octave}` as NoteName,
// } as const;

// ============================================================================
// SECTION 4: Note Name Parsing
// ============================================================================

/**
 * Parsed note name components.
 */
export interface ParsedNoteName {
    /** Pitch class (e.g., "C", "F#", "Bb") */
    readonly pitch: string;
    /** Octave number */
    readonly octave: number;
}
//
// /**
//  * Parse a note name into pitch and octave.
//  * COMPOSER-ONLY: String parsing.
//  *
//  * @param note - Note name string
//
//  * @returns ParsedNoteName or null if invalid
//  */
// export function parseNoteName(note: string): ParsedNoteName | null {
//     if (!note || typeof note !== 'string') return null;
//
//     const match = note.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
//     if (!match) return null;
//
//     const pitch = match[1].charAt(0).toUpperCase() + match[1].slice(1);
//     const octave = parseInt(match[2], 10);
//
//     if (!Number.isFinite(octave)) return null;
//
//     return { pitch, octave };
// }
//
// /**
//  * Create a note name from pitch and octave.
//  * COMPOSER-ONLY: String creation.
//  *
//  * @param pitch - Pitch class (e.g., "C", "F#")
//  * @param octave - Octave number
//
//  * @returns NoteName or null if invalid pitch
//  */
// export function createNoteName(pitch: string, octave: number): NoteName | null {
//     const validPitches = new Set([
//         'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
//         'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
//     ]);
//
//     const normalizedPitch = pitch.charAt(0).toUpperCase() + pitch.slice(1);
//     if (!validPitches.has(normalizedPitch)) return null;
//     if (!Number.isFinite(octave)) return null;
//
//     return `${normalizedPitch}${octave}` as NoteName;
// }

// ============================================================================
// SECTION 5: Pitch Class Utilities
// ============================================================================
//
// /**
//  * All valid pitch class names.
//  * KERNEL-SAFE: Frozen array.
//  */
// export const PITCH_CLASSES: readonly string[] = Object.freeze([
//     'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
//     'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
// ]);
//
// /**
//  * Check if a string is a valid pitch class.
//  * KERNEL-SAFE: Pure check.
//  *
//  * @param value - String to check
//
//  * @returns True if valid pitch class
//  */
// export function isPitchClass(value: string): value is Pitch {
//     return PITCH_CLASSES.includes(value);
// }
//
// // ============================================================================
// // SECTION 6: MIDI Note Conversion (from pitch/midi.ts §1-4)
// // ============================================================================
//
// import type { Interval24EDO } from '@symphonyscript/theory';
// import { asInterval24EDO } from '@symphonyscript/theory';

/**
 * Note names in chromatic order (sharps).
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Flat to sharp conversion.
 */
const FLAT_TO_SHARP: Readonly<Record<string, string>> = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
    'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
};

/**
 * Note name to semitone offset from C.
 */
export const NOTE_TO_SEMITONE: Readonly<Record<string, number>> = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4, 'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Parsed note components.
 */
export interface ParsedNote {
    readonly name: string;
    readonly octave: number;
}

/**
 * Parse a note name into its components.
 * COMPOSER-ONLY: String parsing.
 *
 * @param note - Note string (e.g., "C4", "F#3", "Bb5")

 * @returns ParsedNote or null if invalid
 */
export function parseNote(note: string): ParsedNote | null {
    if (!note || typeof note !== 'string') return null;

    // Match note letter, optional accidental (# or b), and octave
    const match = note.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return null;

    const letter = match[1].toUpperCase();
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    if (!Number.isFinite(octave)) return null;

    // Build note name
    let name = letter + accidental;

    // Convert flats to sharps for consistency
    if (FLAT_TO_SHARP[name]) {
        name = FLAT_TO_SHARP[name];
    }

    // Validate note name
    if (NOTE_TO_SEMITONE[name] === undefined) return null;

    return { name, octave };
}

/**
 * Convert a note name to MIDI number.
 * COMPOSER-ONLY: String parsing.
 *
 * Standard MIDI convention: C4 = 60 (middle C).
 *
 * @param note - Note string (e.g., "C4", "F#3", "Bb5")

 * @returns MIDI number (0-127) or null if invalid
 */
export function noteToMidi(note: string): number | null {
    const parsed = parseNote(note);
    if (!parsed) return null;

    const noteIndex = NOTE_TO_SEMITONE[parsed.name];
    if (noteIndex === undefined) return null;

    // MIDI: C4 = 60, C-1 = 0, C0 = 12
    const midi = (parsed.octave + 1) * 12 + noteIndex;

    // Clamp to valid MIDI range
    if (midi < 0 || midi > 127) return null;

    return midi;
}

/**
 * Convert a MIDI number to note name.
 * COMPOSER-ONLY: String creation.
 *
 * @param midi - MIDI number (0-127)

 * @returns Note string (e.g., "C4") or null if invalid
 */
export function midiToNote(midi: number): string | null {
    if (!Number.isFinite(midi) || midi < 0 || midi > 127) return null;

    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;

    return `${NOTE_NAMES[noteIndex]}${octave}`;
}
//
// /**
//  * Apply transposition to a note name.
//  * COMPOSER-ONLY: String manipulation.
//  *
//  * @param note - Note string (e.g., "C4")
//  * @param semitones - Semitones to transpose (positive = up, negative = down)
//
//  * @returns Transposed note string or null if invalid/out of range
//  */
// export function transposeNote(note: string, semitones: number): string | null {
//     if (semitones === 0) {
//         // Validate the note even if no transposition
//         const parsed = parseNote(note);
//         if (!parsed) return null;
//         return note;
//     }
//
//     const midi = noteToMidi(note);
//     if (midi === null) return null;
//
//     const transposedMidi = midi + semitones;
//
//     // Check valid MIDI range
//     if (transposedMidi < 0 || transposedMidi > 127) return null;
//
//     return midiToNote(transposedMidi);
// }
//
// /**
//  * Convert note name to 24-EDO pitch class.
//  * COMPOSER-ONLY: String parsing.
//  *
//  * @param note - Note string (e.g., "C4", "F#3")
//
//  * @returns 24-EDO pitch class (0-22, even only) or null if invalid
//  */
// export function noteToPitchClass24(note: string): Interval24EDO | null {
//     const parsed = parseNote(note);
//     if (!parsed) return null;
//
//     const semitone = NOTE_TO_SEMITONE[parsed.name];
//     if (semitone === undefined) return null;
//
//     // Convert semitone to 24-EDO (multiply by 2)
//     return asInterval24EDO(semitone * 2);
// }
//
// /**
//  * Convert note name to absolute 24-EDO pitch (with octave).
//  * COMPOSER-ONLY: String parsing.
//  *
//  * @param note - Note string (e.g., "C4", "F#3")
//
//  * @returns Absolute 24-EDO pitch or null if invalid
//  */
// export function noteTo24EDO(note: string): number | null {
//     const parsed = parseNote(note);
//     if (!parsed) return null;
//
//     const semitone = NOTE_TO_SEMITONE[parsed.name];
//     if (semitone === undefined) return null;
//
//     // 24-EDO: each semitone = 2 steps, octave = 24 steps
//     return parsed.octave * 24 + semitone * 2;
// }
