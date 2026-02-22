/**
 * RFC-022: Key Signature Utilities
 *
 * Functions for applying key signature accidentals to notes.
 */

import { ScaleMode, type KeyContext, Accidental } from '../types';

/** Convert ScaleMode to key signature lookup string (major/minor only). */
export function scaleModeToKeyString(mode: ScaleMode): 'major' | 'minor' {
    return mode === ScaleMode.MINOR ? 'minor' : 'major';
}

/**
 * Natural note letters (no accidentals).
 */
const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type NoteLetter = typeof NOTE_LETTERS[number];

/**
 * Parsed note result (out-parameter pattern).
 * letter: 0–6 (C–B), accidental: -1 flat / 0 natural / 1 sharp, octave: number.
 */
interface ParsedNote {
    letter: number;
    accidental: number;
    octave: number;
}

/** Module-level reusable result (zero-allocation). */
const PARSED_NOTE: ParsedNote = { letter: 0, accidental: 0, octave: 4 };

/**
 * Key signature accidentals.
 * Maps 'root:mode' → { noteLetter: accidental }
 * 
 * Circle of fifths:
 * - Sharps: G, D, A, E, B, F#, C# (add F#, C#, G#, D#, A#, E#, B#)
 * - Flats: F, Bb, Eb, Ab, Db, Gb, Cb (add Bb, Eb, Ab, Db, Gb, Cb, Fb)
 */
const KEY_SIGNATURES: Record<string, Partial<Record<NoteLetter, 'sharp' | 'flat'>>> = {
    // Major keys - sharps
    'C:major': {},
    'G:major': { F: 'sharp' },
    'D:major': { F: 'sharp', C: 'sharp' },
    'A:major': { F: 'sharp', C: 'sharp', G: 'sharp' },
    'E:major': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp' },
    'B:major': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp' },
    'F#:major': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp' },
    'C#:major': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp', B: 'sharp' },
    
    // Major keys - flats
    'F:major': { B: 'flat' },
    'Bb:major': { B: 'flat', E: 'flat' },
    'Eb:major': { B: 'flat', E: 'flat', A: 'flat' },
    'Ab:major': { B: 'flat', E: 'flat', A: 'flat', D: 'flat' },
    'Db:major': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat' },
    'Gb:major': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat' },
    'Cb:major': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat', F: 'flat' },
    
    // Minor keys - sharps (relative to major: A=C, E=G, B=D, etc.)
    'A:minor': {},
    'E:minor': { F: 'sharp' },
    'B:minor': { F: 'sharp', C: 'sharp' },
    'F#:minor': { F: 'sharp', C: 'sharp', G: 'sharp' },
    'C#:minor': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp' },
    'G#:minor': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp' },
    'D#:minor': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp' },
    'A#:minor': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp', B: 'sharp' },
    
    // Minor keys - flats
    'D:minor': { B: 'flat' },
    'G:minor': { B: 'flat', E: 'flat' },
    'C:minor': { B: 'flat', E: 'flat', A: 'flat' },
    'F:minor': { B: 'flat', E: 'flat', A: 'flat', D: 'flat' },
    'Bb:minor': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat' },
    'Eb:minor': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat' },
    'Ab:minor': { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat', F: 'flat' },
};

/**
 * Parse a note name into out-parameter. Zero-allocation for hot paths.
 * @param note - Note string (e.g., 'F#4')
 * @param out - Reusable result object (default: module-level PARSED_NOTE)
 * @returns out on success, null if parse fails
 */
function parseNoteName(note: string, out: ParsedNote = PARSED_NOTE): ParsedNote | null {
    const match = note.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!match) return null;

    const letterChar = match[1].charCodeAt(0);
    const base = letterChar >= 97 ? letterChar - 97 : letterChar - 65; // 0-6 for A-G or a-g
    out.letter = [5, 6, 0, 1, 2, 3, 4][base]; // map to C=0,D=1,E=2,F=3,G=4,A=5,B=6
    const a = match[2];
    out.accidental = a === '#' ? 1 : a === 'b' ? -1 : 0;
    out.octave = parseInt(match[3], 10);
    return out;
}

/** Letter index 0-6 to NoteLetter for KEY_SIGNATURES lookup. */
function letterToNoteLetter(idx: number): NoteLetter {
    return NOTE_LETTERS[idx];
}

/**
 * Apply key signature to a note name.
 * Uses out-parameter parseNoteName and parses once per call.
 *
 * @param noteName - Original note (e.g., 'F4')
 * @param keyContext - Key signature context
 * @param overrideAccidental - Explicit accidental override
 * @returns Modified note name (e.g., 'F#4' in G major)
 */
export function applyKeySignature(
    noteName: string,
    keyContext: KeyContext | null,
    overrideAccidental?: Accidental | null
): string {
    // No override and no key → return as-is (avoid parse)
    if (!overrideAccidental && !keyContext) {
        return noteName;
    }

    const parsed = parseNoteName(noteName);
    if (!parsed) return noteName;

    const letter = letterToNoteLetter(parsed.letter);

    // Override NATURAL: strip accidental
    if (overrideAccidental === Accidental.NATURAL) {
        return letter + String(parsed.octave);
    }

    // Override SHARP or FLAT
    if (overrideAccidental === Accidental.SHARP) {
        return letter + '#' + String(parsed.octave);
    }
    if (overrideAccidental === Accidental.FLAT) {
        return letter + 'b' + String(parsed.octave);
    }

    // Note already has accidental → respect it
    if (parsed.accidental !== 0) return noteName;

    // No key context → return as-is
    if (!keyContext) return noteName;

    const modeStr = scaleModeToKeyString(keyContext.mode);
    const keyStr = keyContext.root + ':' + modeStr;
    const keyAccidentals = KEY_SIGNATURES[keyStr];
    if (!keyAccidentals) return noteName;

    const keyAccidental = keyAccidentals[letter];
    if (keyAccidental) {
        return letter + (keyAccidental === 'sharp' ? '#' : 'b') + String(parsed.octave);
    }
    return noteName;
}

/**
 * Check if a note name has an explicit accidental.
 */
export function hasExplicitAccidental(noteName: string): boolean {
    const match = noteName.match(/^[A-Ga-g]([#b])/);
    return match !== null && match[1] !== '';
}
