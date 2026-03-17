/**
 * RFC-047: Key Signatures (24-EDO Native)
 *
 * Key signature management using 24-EDO pitch classes.
 * Accidentals are stored as HarmonyMask bitmasks.
 */

import type { HarmonyMask, Interval24EDO } from '@symphonyscript/theory';
import { asHarmonyMask, asInterval24EDO } from '@symphonyscript/theory';
import { OCTAVE_SIZE } from '@symphonyscript/theory';
import { PitchClass } from './pitch-class';
import { ScaleMode } from './scale-mode';

/**
 * Key context for chord and key signature resolution.
 */
export interface KeyContext {
    /** Root pitch class in 24-EDO */
    readonly root: PitchClass;
    /** Mode */
    readonly mode: ScaleMode;
}

// ============================================================================
// SECTION 1: Key Signature Data
// ============================================================================

/**
 * Key signature accidentals as bitmasks.
 * Each bit represents a pitch class that is sharped or flatted.
 *
 * Format: 'root:mode' → { sharps: HarmonyMask, flats: HarmonyMask }
 */
interface KeySignatureData {
    readonly sharps: HarmonyMask;
    readonly flats: HarmonyMask;
}

/**
 * Natural note pitch classes in 24-EDO.
 * C=0, D=4, E=8, F=10, G=14, A=18, B=22
 */
const NATURAL_NOTES = {
    C: 0, D: 4, E: 8, F: 10, G: 14, A: 18, B: 22
} as const;

/**
 * Create a bitmask from pitch classes.
 */
function createMask(...pitchClasses: number[]): HarmonyMask {
    let mask = 0;
    for (const pc of pitchClasses) {
        mask |= (1 << pc);
    }
    return asHarmonyMask(mask);
}

/**
 * Key signatures with their accidentals.
 * KERNEL-SAFE: Frozen lookup table.
 */
const KEY_SIGNATURE_DATA: Readonly<Record<string, KeySignatureData>> = Object.freeze({
    // Major keys - sharps (circle of fifths)
    'C:major': { sharps: asHarmonyMask(0), flats: asHarmonyMask(0) },
    'G:major': { sharps: createMask(NATURAL_NOTES.F + 2), flats: asHarmonyMask(0) }, // F#
    'D:major': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2), flats: asHarmonyMask(0) }, // F#, C#
    'A:major': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2), flats: asHarmonyMask(0) }, // F#, C#, G#
    'E:major': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2, NATURAL_NOTES.D + 2), flats: asHarmonyMask(0) }, // F#, C#, G#, D#
    'B:major': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2, NATURAL_NOTES.D + 2, NATURAL_NOTES.A + 2), flats: asHarmonyMask(0) }, // F#, C#, G#, D#, A#

    // Major keys - flats
    'F:major': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2) }, // Bb
    'Bb:major': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2) }, // Bb, Eb
    'Eb:major': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2) }, // Bb, Eb, Ab
    'Ab:major': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2, NATURAL_NOTES.D - 2) }, // Bb, Eb, Ab, Db
    'Db:major': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2, NATURAL_NOTES.D - 2, NATURAL_NOTES.G - 2) }, // Bb, Eb, Ab, Db, Gb

    // Minor keys - sharps (relative to major)
    'A:minor': { sharps: asHarmonyMask(0), flats: asHarmonyMask(0) },
    'E:minor': { sharps: createMask(NATURAL_NOTES.F + 2), flats: asHarmonyMask(0) }, // F#
    'B:minor': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2), flats: asHarmonyMask(0) }, // F#, C#
    'F#:minor': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2), flats: asHarmonyMask(0) }, // F#, C#, G#
    'C#:minor': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2, NATURAL_NOTES.D + 2), flats: asHarmonyMask(0) }, // F#, C#, G#, D#
    'G#:minor': { sharps: createMask(NATURAL_NOTES.F + 2, NATURAL_NOTES.C + 2, NATURAL_NOTES.G + 2, NATURAL_NOTES.D + 2, NATURAL_NOTES.A + 2), flats: asHarmonyMask(0) }, // F#, C#, G#, D#, A#

    // Minor keys - flats
    'D:minor': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2) }, // Bb
    'G:minor': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2) }, // Bb, Eb
    'C:minor': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2) }, // Bb, Eb, Ab
    'F:minor': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2, NATURAL_NOTES.D - 2) }, // Bb, Eb, Ab, Db
    'Bb:minor': { sharps: asHarmonyMask(0), flats: createMask(NATURAL_NOTES.B - 2, NATURAL_NOTES.E - 2, NATURAL_NOTES.A - 2, NATURAL_NOTES.D - 2, NATURAL_NOTES.G - 2) }, // Bb, Eb, Ab, Db, Gb
});

// ============================================================================
// SECTION 2: Key Signature Lookup
// ============================================================================

/**
 * Get the key signature string from a KeyContext.
 */
function keyContextToString(key: KeyContext): string {
    // Convert PitchClass (24-EDO) root to note name
    const rootNames: Record<number, string> = {
        0: 'C', 2: 'C#', 4: 'D', 6: 'Eb', 8: 'E', 10: 'F',
        12: 'F#', 14: 'G', 16: 'Ab', 18: 'A', 20: 'Bb', 22: 'B'
    };
    const rootName = rootNames[Number(key.root)] ?? 'C';
    const modeStr = key.mode === ScaleMode.MINOR ? 'minor' : 'major';
    return `${rootName}:${modeStr}`;
}

/**
 * Get the sharps mask for a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context

 * @returns Bitmask of sharped pitch classes
 */
export function getKeySharps(key: KeyContext): HarmonyMask {
    const keyStr = keyContextToString(key);
    return KEY_SIGNATURE_DATA[keyStr]?.sharps ?? asHarmonyMask(0);
}

/**
 * Get the flats mask for a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context

 * @returns Bitmask of flatted pitch classes
 */
export function getKeyFlats(key: KeyContext): HarmonyMask {
    const keyStr = keyContextToString(key);
    return KEY_SIGNATURE_DATA[keyStr]?.flats ?? asHarmonyMask(0);
}

/**
 * Get combined accidentals mask for a key.
 * KERNEL-SAFE: Pure lookup and bitwise.
 *
 * @param key - Key context

 * @returns Combined bitmask of all accidentals
 */
export function getKeyAccidentals(key: KeyContext): HarmonyMask {
    const sharps = getKeySharps(key);
    const flats = getKeyFlats(key);
    return asHarmonyMask(Number(sharps) | Number(flats));
}

/**
 * Check if a key signature is valid.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param key - Key context

 * @returns True if key is recognized
 */
export function isValidKey(key: KeyContext): boolean {
    const keyStr = keyContextToString(key);
    return keyStr in KEY_SIGNATURE_DATA;
}

/**
 * Count the number of sharps in a key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param key - Key context

 * @returns Number of sharps (0-7)
 */
export function countSharps(key: KeyContext): number {
    const sharps = getKeySharps(key);
    let count = 0;
    let mask = Number(sharps);
    while (mask) {
        count += mask & 1;
        mask >>= 1;
    }
    return count;
}

/**
 * Count the number of flats in a key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param key - Key context

 * @returns Number of flats (0-7)
 */
export function countFlats(key: KeyContext): number {
    const flats = getKeyFlats(key);
    let count = 0;
    let mask = Number(flats);
    while (mask) {
        count += mask & 1;
        mask >>= 1;
    }
    return count;
}

// ============================================================================
// SECTION 3: Pitch Class Adjustment
// ============================================================================

/**
 * Check if a pitch class is sharped in the key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - 24-EDO pitch class
 * @param key - Key context

 * @returns True if pitch class is sharped
 */
export function isSharpedInKey(pitchClass: Interval24EDO, key: KeyContext): boolean {
    const sharps = getKeySharps(key);
    return (Number(sharps) & (1 << Number(pitchClass))) !== 0;
}

/**
 * Check if a pitch class is flatted in the key.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - 24-EDO pitch class
 * @param key - Key context

 * @returns True if pitch class is flatted
 */
export function isFlattedInKey(pitchClass: Interval24EDO, key: KeyContext): boolean {
    const flats = getKeyFlats(key);
    return (Number(flats) & (1 << Number(pitchClass))) !== 0;
}

/**
 * Apply key signature to a pitch class.
 * KERNEL-SAFE: Pure bitwise.
 *
 * @param pitchClass - Natural pitch class (0, 4, 8, 10, 14, 18, 22)
 * @param key - Key context

 * @returns Adjusted pitch class with key signature applied
 */
export function applyKeyToPitchClass(
    pitchClass: Interval24EDO,
    key: KeyContext
): Interval24EDO {
    const pc = Number(pitchClass);

    // Check if this natural note is sharped
    const sharps = Number(getKeySharps(key));
    if (sharps & (1 << (pc + 2))) {
        return asInterval24EDO((pc + 2) % OCTAVE_SIZE);
    }

    // Check if this natural note is flatted
    const flats = Number(getKeyFlats(key));
    if (flats & (1 << ((pc - 2 + OCTAVE_SIZE) % OCTAVE_SIZE))) {
        return asInterval24EDO((pc - 2 + OCTAVE_SIZE) % OCTAVE_SIZE);
    }

    return pitchClass;
}

// ============================================================================
// SECTION 4: Relative/Parallel Keys
// ============================================================================

/**
 * Get the relative minor of a major key.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param majorKey - Major key context

 * @returns Relative minor key context, or null if input is not major
 */
export function getRelativeMinor(majorKey: KeyContext): KeyContext | null {
    if (majorKey.mode !== ScaleMode.MAJOR) return null;

    // Relative minor is 3 semitones (6 in 24-EDO) below
    const minorRoot = asInterval24EDO(
        (Number(majorKey.root) - 6 + OCTAVE_SIZE) % OCTAVE_SIZE
    );

    return { root: minorRoot as unknown as PitchClass, mode: ScaleMode.MINOR };
}

/**
 * Get the relative major of a minor key.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param minorKey - Minor key context

 * @returns Relative major key context, or null if input is not minor
 */
export function getRelativeMajor(minorKey: KeyContext): KeyContext | null {
    if (minorKey.mode !== ScaleMode.MINOR) return null;

    // Relative major is 3 semitones (6 in 24-EDO) above
    const majorRoot = asInterval24EDO(
        (Number(minorKey.root) + 6) % OCTAVE_SIZE
    );

    return { root: majorRoot as unknown as PitchClass, mode: ScaleMode.MAJOR };
}

/**
 * Get the parallel minor of a major key.
 * KERNEL-SAFE: Pure construction.
 *
 * @param majorKey - Major key context

 * @returns Parallel minor (same root, minor mode)
 */
export function getParallelMinor(majorKey: KeyContext): KeyContext | null {
    if (majorKey.mode !== ScaleMode.MAJOR) return null;
    return { root: majorKey.root, mode: ScaleMode.MINOR };
}

/**
 * Get the parallel major of a minor key.
 * KERNEL-SAFE: Pure construction.
 *
 * @param minorKey - Minor key context

 * @returns Parallel major (same root, major mode)
 */
export function getParallelMajor(minorKey: KeyContext): KeyContext | null {
    if (minorKey.mode !== ScaleMode.MINOR) return null;
    return { root: minorKey.root, mode: ScaleMode.MAJOR };
}

// ============================================================================
// SECTION 5: Key Constants
// ============================================================================

/**
 * All valid key signatures.
 * KERNEL-SAFE: Frozen array.
 */
export const ALL_KEYS: readonly string[] = Object.freeze(
    Object.keys(KEY_SIGNATURE_DATA)
);

/**
 * Major keys in circle of fifths order.
 * KERNEL-SAFE: Frozen array.
 */
export const MAJOR_KEYS_CIRCLE: readonly string[] = Object.freeze([
    'C:major', 'G:major', 'D:major', 'A:major', 'E:major', 'B:major',
    'F#:major', 'Db:major', 'Ab:major', 'Eb:major', 'Bb:major', 'F:major'
]);

/**
 * Minor keys in circle of fifths order.
 * KERNEL-SAFE: Frozen array.
 */
export const MINOR_KEYS_CIRCLE: readonly string[] = Object.freeze([
    'A:minor', 'E:minor', 'B:minor', 'F#:minor', 'C#:minor', 'G#:minor',
    'D#:minor', 'Bb:minor', 'F:minor', 'C:minor', 'G:minor', 'D:minor'
]);

// ============================================================================
// SECTION 6: Apply Key Signature to Note Names
// ============================================================================

/**
 * Accidental override type.
 */
export type AccidentalOverride = 'sharp' | 'flat' | 'natural';

/**
 * Parse a note name into letter, accidental, and octave.
 * Internal helper for applyKeySignature.
 */
function parseNoteNameInternal(noteName: string): { letter: string; accidental: string; octave: number } | null {
    if (!noteName || typeof noteName !== 'string') return null;

    const match = noteName.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return null;

    const letter = match[1].toUpperCase();
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    if (!Number.isFinite(octave)) return null;

    return { letter, accidental, octave };
}

/**
 * Map of note letters to their 24-EDO pitch class (natural notes).
 */
const LETTER_TO_PITCH_CLASS: Readonly<Record<string, number>> = {
    'C': 0, 'D': 4, 'E': 8, 'F': 10, 'G': 14, 'A': 18, 'B': 22
};

/**
 * Apply key signature accidentals to a note name.
 * COMPOSER-ONLY: String manipulation.
 *
 * @param noteName - Note name (e.g., "F4")
 * @param key - Key context (or null for no key)
 * @param overrideAccidental - Explicit accidental ('sharp', 'flat', 'natural')

 * @returns Modified note name (e.g., "F#4" in G major), or null if invalid
 */
export function applyKeySignature(
    noteName: string,
    key: KeyContext | null,
    overrideAccidental?: AccidentalOverride
): string | null {
    const parsed = parseNoteNameInternal(noteName);
    if (!parsed) return null;

    // If override is 'natural', return without accidental
    if (overrideAccidental === 'natural') {
        return `${parsed.letter}${parsed.octave}`;
    }

    // If override is 'sharp', apply sharp directly
    if (overrideAccidental === 'sharp') {
        return `${parsed.letter}#${parsed.octave}`;
    }

    // If override is 'flat', apply flat directly
    if (overrideAccidental === 'flat') {
        return `${parsed.letter}b${parsed.octave}`;
    }

    // No key context → return as-is
    if (!key) {
        return noteName;
    }

    // If note already has an accidental, preserve it
    if (parsed.accidental) {
        return noteName;
    }

    // Look up the pitch class for this letter
    const naturalPitchClass = LETTER_TO_PITCH_CLASS[parsed.letter];
    if (naturalPitchClass === undefined) return null;

    // Get key signature masks
    const sharps = Number(getKeySharps(key));
    const flats = Number(getKeyFlats(key));

    // Check if this note letter should be sharped
    // The sharps mask has bits set at (natural + 2) positions
    const sharpedPitchClass = (naturalPitchClass + 2) % OCTAVE_SIZE;
    if (sharps & (1 << sharpedPitchClass)) {
        return `${parsed.letter}#${parsed.octave}`;
    }

    // Check if this note letter should be flatted
    // The flats mask has bits set at (natural - 2) positions
    const flattedPitchClass = (naturalPitchClass - 2 + OCTAVE_SIZE) % OCTAVE_SIZE;
    if (flats & (1 << flattedPitchClass)) {
        return `${parsed.letter}b${parsed.octave}`;
    }

    // No accidental needed
    return noteName;
}

// ============================================================================
// SECTION 7: Key Root Constants
// ============================================================================

/**
 * Common key roots as PitchClass values.
 * KERNEL-SAFE: Frozen constants.
 *
 * Usage:
 * ```typescript
 * const key: KeyContext = { root: KEY_ROOT.C, mode: ScaleMode.MAJOR };
 * ```
 */
export const KEY_ROOT = {
    C: PitchClass.C,
    Cs: PitchClass.Cs,
    Db: PitchClass.Db,
    D: PitchClass.D,
    Ds: PitchClass.Ds,
    Eb: PitchClass.Eb,
    E: PitchClass.E,
    F: PitchClass.F,
    Fs: PitchClass.Fs,
    Gb: PitchClass.Gb,
    G: PitchClass.G,
    Gs: PitchClass.Gs,
    Ab: PitchClass.Ab,
    A: PitchClass.A,
    As: PitchClass.As,
    Bb: PitchClass.Bb,
    B: PitchClass.B,
} as const;
