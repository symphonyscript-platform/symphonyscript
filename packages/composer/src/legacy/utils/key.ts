/**
 * RFC-022: Key Signature Utilities
 *
 * Functions for applying key signature accidentals to notes.
 */

import { Accidental, type KeyContext, ScaleMode } from '../types'
import { NOTE_TO_SEMITONE } from '@symphonyscript/theory'

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
 * letter: 0–6 (C–B), accidental: -1 flat / 0 natural / 1 sharp.
 */
interface ParsedNote {
    letter: number;
    accidental: number;
    octaveStart: number;
    octave: number;
}

/** Module-level reusable result (zero-allocation). */
const PARSED_NOTE: ParsedNote = { letter: 0, accidental: 0, octaveStart: 1, octave: 0 };

/** O(1) mapping from local letter index to true note index. */
const BASE_LETTER_MAP = [5, 6, 0, 1, 2, 3, 4] as const;

/**
 * Key signature accidentals.
 * Maps 'root:mode' → { noteLetter: accidental }
 * 
 * Circle of fifths:
 * - Sharps: G, D, A, E, B, F#, C# (add F#, C#, G#, D#, A#, E#, B#)
 * - Flats: F, Bb, Eb, Ab, Db, Gb, Cb (add Bb, Eb, Ab, Db, Gb, Cb, Fb)
 */
const KEY_SIGNATURES_MAJOR: Record<string, Partial<Record<NoteLetter, 'sharp' | 'flat'>>> = {
    // Major keys - sharps
    C: {},
    G: { F: 'sharp' },
    D: { F: 'sharp', C: 'sharp' },
    A: { F: 'sharp', C: 'sharp', G: 'sharp' },
    E: { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp' },
    B: { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp' },
    'F#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp' },
    'C#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp', B: 'sharp' },

    // Major keys - flats
    F: { B: 'flat' },
    Bb: { B: 'flat', E: 'flat' },
    Eb: { B: 'flat', E: 'flat', A: 'flat' },
    Ab: { B: 'flat', E: 'flat', A: 'flat', D: 'flat' },
    Db: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat' },
    Gb: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat' },
    Cb: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat', F: 'flat' },
};

const KEY_SIGNATURES_MINOR: Record<string, Partial<Record<NoteLetter, 'sharp' | 'flat'>>> = {
    // Minor keys - sharps (relative to major: A=C, E=G, B=D, etc.)
    A: {},
    E: { F: 'sharp' },
    B: { F: 'sharp', C: 'sharp' },
    'F#': { F: 'sharp', C: 'sharp', G: 'sharp' },
    'C#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp' },
    'G#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp' },
    'D#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp' },
    'A#': { F: 'sharp', C: 'sharp', G: 'sharp', D: 'sharp', A: 'sharp', E: 'sharp', B: 'sharp' },

    // Minor keys - flats
    D: { B: 'flat' },
    G: { B: 'flat', E: 'flat' },
    C: { B: 'flat', E: 'flat', A: 'flat' },
    F: { B: 'flat', E: 'flat', A: 'flat', D: 'flat' },
    Bb: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat' },
    Eb: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat' },
    Ab: { B: 'flat', E: 'flat', A: 'flat', D: 'flat', G: 'flat', C: 'flat', F: 'flat' },
};

/**
 * Parse a note name into out-parameter. Zero-allocation for hot paths.
 * @param note - Note string (e.g., 'F#4')
 * @param out - Reusable result object (default: module-level PARSED_NOTE)

 * @returns out on success, null if parse fails
 */
function parseNoteName(note: string, out: ParsedNote = PARSED_NOTE): ParsedNote | null {
    const len = note.length;
    if (len < 2) return null;

    const c0 = note.charCodeAt(0);
    let base: number;
    if (c0 >= 65 && c0 <= 71) {
        base = c0 - 65; // A-G (0-6)
    } else if (c0 >= 97 && c0 <= 103) {
        base = c0 - 97; // a-g (0-6)
    } else {
        return null;
    }

    out.letter = BASE_LETTER_MAP[base]; // map to C=0,D=1,E=2,F=3,G=4,A=5,B=6

    let octaveStart = 1;
    out.accidental = 0;

    const c1 = note.charCodeAt(1);
    if (c1 === 35) { // '#'
        out.accidental = 1;
        octaveStart = 2;
    } else if (c1 === 98) { // 'b'
        out.accidental = -1;
        octaveStart = 2;
    }

    if (octaveStart >= len) return null;
    out.octaveStart = octaveStart;

    let i = octaveStart;
    let sign = 1;

    if (note.charCodeAt(i) === 45) { // '-'
        sign = -1;
        i++;
    }

    if (i >= len) return null;

    let octave = 0;
    for (; i < len; i++) {
        const d = note.charCodeAt(i);
        if (d < 48 || d > 57) return null;
        octave = octave * 10 + (d - 48);
    }
    out.octave = sign * octave;

    return out;
}

export function pitchToSemitone(pitch: string): number | null {
    const normalized = pitch.charAt(0).toUpperCase() + pitch.slice(1)
    const semitone = NOTE_TO_SEMITONE[normalized]

    return semitone ?? null
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
    const octave = String(parsed.octave);

    // Override NATURAL: strip accidental
    if (overrideAccidental === Accidental.NATURAL) {
        return letter + octave;
    }

    // Override SHARP or FLAT
    if (overrideAccidental === Accidental.SHARP) {
        return letter + '#' + octave;
    }
    if (overrideAccidental === Accidental.FLAT) {
        return letter + 'b' + octave;
    }

    // Note already has accidental → respect it
    if (parsed.accidental !== 0) return noteName;

    // No key context → return as-is
    if (!keyContext) return noteName;

    const keyAccidentals = keyContext.mode === ScaleMode.MINOR
        ? KEY_SIGNATURES_MINOR[keyContext.root]
        : KEY_SIGNATURES_MAJOR[keyContext.root];
    if (!keyAccidentals) return noteName;

    const keyAccidental = keyAccidentals[letter];
    if (keyAccidental) {
        return letter + (keyAccidental === 'sharp' ? '#' : 'b') + octave;
    }
    return noteName;
}

/**
 * Check if a note name has an explicit accidental.
 */
export function hasExplicitAccidental(noteName: string): boolean {
    if (noteName.length < 2) return false;

    const c0 = noteName.charCodeAt(0);
    const isLetter = (c0 >= 65 && c0 <= 71) || (c0 >= 97 && c0 <= 103);
    if (!isLetter) return false;

    const c1 = noteName.charCodeAt(1);
    return c1 === 35 || c1 === 98; // # or b
}
