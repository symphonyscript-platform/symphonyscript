/**
 * RFC-047: Chord Resolver (24-EDO Native)
 *
 * Parse chord codes and resolve them to note names.
 * Uses existing CHORD_MAP from definitions.ts.
 */

import type { HarmonyMask } from '../types';
import { CHORD_MAP } from './definitions';
import { unpackToArray } from '../packer';
import { midiToNote, noteToMidi } from '../pitch/midi';
import type { NoteName } from '../pitch/notes';
import { unsafeNoteName } from '../pitch/notes';

// ============================================================================
// SECTION 1: Types
// ============================================================================

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

// ============================================================================
// SECTION 2: Constants
// ============================================================================

/**
 * Valid chord root notes.
 */
const VALID_ROOTS = new Set([
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
    'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
]);

/**
 * Regex to parse chord code into root and suffix.
 */
const CHORD_CODE_REGEX = /^([A-Ga-g][#b]?)(.*)$/;

// ============================================================================
// SECTION 3: Chord Parsing
// ============================================================================

/**
 * Check if a string is a valid chord root.
 * KERNEL-SAFE: Pure check.
 *
 * @param root - String to check

 * @returns True if valid root
 */
export function isChordRoot(root: string): boolean {
    return VALID_ROOTS.has(root);
}

/**
 * Parse a chord code into its components.
 * COMPOSER-ONLY: String parsing, returns null instead of throw.
 *
 * @param code - Chord code (e.g., "Cmaj7", "F#m", "Bb7")

 * @returns ParsedChord or null if invalid
 */
export function parseChordCode(code: string): ParsedChord | null {
    if (!code || typeof code !== 'string') return null;

    const match = code.match(CHORD_CODE_REGEX);
    if (!match) return null;

    // Normalize root (capitalize first letter)
    const rootRaw = match[1];
    const root = rootRaw.charAt(0).toUpperCase() + rootRaw.slice(1);
    const suffix = match[2];

    // Validate root
    if (!isChordRoot(root)) return null;

    // Look up chord mask by suffix
    const mask = CHORD_MAP.get(suffix);
    if (mask === undefined) return null;

    // Extract intervals from mask and convert 24-EDO to 12-TET
    const intervals24 = unpackToArray(mask).map(Number);
    const intervals12 = intervals24.map(i => Math.floor(i / 2));

    return {
        root,
        quality: suffix,
        intervals: Object.freeze(intervals12),
        mask
    };
}

/**
 * Get the quality name for a chord suffix.
 * COMPOSER-ONLY: Lookup function.
 *
 * @param suffix - Chord suffix

 * @returns Human-readable quality name or null
 */
export function getChordQualityName(suffix: string): string | null {
    const names: Record<string, string> = {
        '': 'Major',
        'maj': 'Major',
        'm': 'Minor',
        'min': 'Minor',
        '7': 'Dominant 7th',
        'maj7': 'Major 7th',
        'm7': 'Minor 7th',
        'dim': 'Diminished',
        'dim7': 'Diminished 7th',
        'aug': 'Augmented',
        'sus4': 'Suspended 4th',
        'sus2': 'Suspended 2nd',
        '5': 'Power Chord',
        'm7b5': 'Half-Diminished',
        '9': 'Dominant 9th',
        'maj9': 'Major 9th',
        'm9': 'Minor 9th',
    };

    return names[suffix] ?? null;
}

// ============================================================================
// SECTION 4: Chord Resolution
// ============================================================================

/**
 * Resolve a chord code to specific note names.
 * COMPOSER-ONLY: String parsing and allocation.
 *
 * @param code - Chord code (e.g., "Cmaj7", "F#m")
 * @param octave - Base octave for the root note

 * @returns Array of NoteName or null if invalid
 */
export function chordToNotes(code: string, octave: number): NoteName[] | null {
    // Parse the chord code
    const parsed = parseChordCode(code);
    if (parsed === null) return null;

    // Validate octave
    if (!Number.isFinite(octave)) return null;

    // Get root MIDI number
    const rootNote = `${parsed.root}${octave}`;
    const rootMidi = noteToMidi(rootNote);
    if (rootMidi === null) return null;

    // Calculate MIDI numbers for all intervals
    const midiNumbers = parsed.intervals.map(interval => rootMidi + interval);

    // Convert back to note names
    const notes: NoteName[] = [];
    for (const midi of midiNumbers) {
        // Check MIDI range
        if (midi < 0 || midi > 127) return null;

        const noteName = midiToNote(midi);
        if (noteName === null) return null;

        notes.push(unsafeNoteName(noteName));
    }

    return notes;
}

/**
 * Resolve a chord code to MIDI note numbers.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code (e.g., "Cmaj7")
 * @param octave - Base octave for the root note

 * @returns Array of MIDI numbers or null if invalid
 */
export function chordToMidi(code: string, octave: number): number[] | null {
    const parsed = parseChordCode(code);
    if (parsed === null) return null;

    if (!Number.isFinite(octave)) return null;

    const rootNote = `${parsed.root}${octave}`;
    const rootMidi = noteToMidi(rootNote);
    if (rootMidi === null) return null;

    const midiNumbers = parsed.intervals.map(interval => rootMidi + interval);

    // Validate all MIDI numbers are in range
    for (const midi of midiNumbers) {
        if (midi < 0 || midi > 127) return null;
    }

    return midiNumbers;
}

// ============================================================================
// SECTION 5: Chord Utilities
// ============================================================================

/**
 * Get all supported chord suffixes.
 * COMPOSER-ONLY: Creates array.
 *
 * @returns Array of supported chord suffixes
 */
export function getSupportedChordSuffixes(): string[] {
    return Array.from(CHORD_MAP.keys());
}

/**
 * Check if a chord code is valid.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code to check

 * @returns True if valid
 */
export function isValidChordCode(code: string): boolean {
    return parseChordCode(code) !== null;
}

/**
 * Get the interval count for a chord.
 * COMPOSER-ONLY: String parsing.
 *
 * @param code - Chord code

 * @returns Number of notes in chord, or null if invalid
 */
export function getChordSize(code: string): number | null {
    const parsed = parseChordCode(code);
    return parsed?.intervals.length ?? null;
}
