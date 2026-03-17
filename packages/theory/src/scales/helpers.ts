/**
 * RFC-047: Scale Note Helpers (24-EDO Native)
 *
 * Functions for converting scale degrees to concrete note names.
 * Bridges the gap between abstract scale theory and playable notes.
 */

import type { HarmonyMask } from '../types'
import { getScaleIntervals, SCALE } from './scales'
import type { NoteName } from '@symphonyscript/notations'
import { unsafeNoteName } from '@symphonyscript/notations'
import { ScaleMode } from '@symphonyscript/notations'

/**
 * Scale context for degree-based notation.
 */
export interface ScaleContext {
    /** Root note (e.g., "C", "F#") */
    readonly root: string;
    /** Scale mode */
    readonly mode: ScaleMode;
    /** Default octave for degree 1 */
    readonly octave: number;
}

/**
 * Note names in chromatic order (sharps).
 */
const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Note names in chromatic order (flats).
 */
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/**
 * Scale mode to SCALE mask mapping.
 */
const MODE_TO_SCALE: Readonly<Record<ScaleMode, HarmonyMask | undefined>> = {
    [ScaleMode.NONE]: undefined,
    [ScaleMode.MAJOR]: SCALE.MAJOR,
    [ScaleMode.MINOR]: SCALE.MINOR,
    [ScaleMode.HARMONIC_MINOR]: SCALE.HARMONIC_MINOR,
    [ScaleMode.MELODIC_MINOR]: SCALE.MELODIC_MINOR,
    [ScaleMode.DORIAN]: SCALE.DORIAN,
    [ScaleMode.PHRYGIAN]: SCALE.PHRYGIAN,
    [ScaleMode.LYDIAN]: SCALE.LYDIAN,
    [ScaleMode.MIXOLYDIAN]: SCALE.MIXOLYDIAN,
    [ScaleMode.LOCRIAN]: SCALE.LOCRIAN,
    [ScaleMode.PENTATONIC_MAJOR]: SCALE.PENTATONIC_MAJOR,
    [ScaleMode.PENTATONIC_MINOR]: SCALE.PENTATONIC_MINOR,
    [ScaleMode.BLUES]: SCALE.BLUES,
    [ScaleMode.CHROMATIC]: SCALE.CHROMATIC,
    [ScaleMode.WHOLE_TONE]: SCALE.WHOLE_TONE,
    [ScaleMode.DIMINISHED_HW]: SCALE.DIMINISHED_HW,
    [ScaleMode.DIMINISHED_WH]: SCALE.DIMINISHED_WH,
    [ScaleMode.BEBOP_DOMINANT]: SCALE.BEBOP_DOMINANT,
    [ScaleMode.BEBOP_MAJOR]: SCALE.BEBOP_MAJOR,
    [ScaleMode.HIRAJOSHI]: SCALE.HIRAJOSHI,
    [ScaleMode.IN_SEN]: SCALE.IN_SEN,
    [ScaleMode.HUNGARIAN_MINOR]: SCALE.HUNGARIAN_MINOR,
    [ScaleMode.PHRYGIAN_DOMINANT]: SCALE.PHRYGIAN_DOMINANT,
};

/**
 * Resolve a scale degree to a MIDI pitch number.
 * KERNEL-SAFE: Pure arithmetic (no string allocation).
 *
 * @param degree - Scale degree (1-indexed, wraps across octaves)
 * @param rootPitchClass - Root note as pitch class (0-11)
 * @param mode - Scale mode
 * @param baseOctave - Base octave for degree 1 (default: 4)
 * @param alteration - Chromatic alteration in semitones (default: 0)
 * @param octaveOffset - Additional octave offset (default: 0)

 * @returns MIDI pitch number or null if invalid mode
 */
export function degreeToPitch(
    degree: number,
    rootPitchClass: number,
    mode: ScaleMode,
    baseOctave: number = 4,
    alteration: number = 0,
    octaveOffset: number = 0,
): number | null {
    const scaleMask = MODE_TO_SCALE[mode];
    if (scaleMask === undefined) return null;

    const intervals24 = getScaleIntervals(scaleMask);
    if (intervals24.length === 0) return null;

    const scaleLen = intervals24.length;
    const idx = degree - 1;

    const baseIdx = ((idx % scaleLen) + scaleLen) % scaleLen;
    const octaveFromDegree = Math.floor(idx / scaleLen);

    const intervalSemitone = Math.floor(Number(intervals24[baseIdx]) / 2);

    return (baseOctave + octaveOffset + octaveFromDegree + 1) * 12
        + rootPitchClass
        + intervalSemitone
        + alteration;
}

/**
 * Flat root notes (use flats for accidentals).
 */
const FLAT_ROOTS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);

/**
 * Flat minor roots (use flats for accidentals).
 */
const FLAT_MINOR_ROOTS = new Set(['D', 'G', 'C', 'F', 'Bb', 'Eb']);

/**
 * Parse root note to semitone offset (0-11).
 * KERNEL-SAFE: Returns null instead of throw.
 *
 * @param root - Root note string (e.g., "C", "F#", "Bb")

 * @returns Semitone offset (0-11) or null if invalid
 */
export function parseRoot(root: string): number | null {
    if (!root || typeof root !== 'string') return null;

    const match = root.match(/^([A-Ga-g])([#b]?)$/);
    if (!match) return null;

    const letter = match[1].toUpperCase();
    const accidental = match[2];

    // Find base semitone
    let semitone = NOTE_NAMES_SHARP.indexOf(letter as typeof NOTE_NAMES_SHARP[number]);
    if (semitone === -1) {
        semitone = NOTE_NAMES_FLAT.indexOf(letter as typeof NOTE_NAMES_FLAT[number]);
    }
    if (semitone === -1) return null;

    // Apply accidental
    if (accidental === '#') semitone++;
    if (accidental === 'b') semitone--;

    // Normalize to 0-11
    return ((semitone % 12) + 12) % 12;
}

/**
 * Convert scale degree to concrete note name.
 * COMPOSER-ONLY: String allocation.
 *
 * @param degree - Scale degree (1-indexed)
 * @param root - Root note string
 * @param mode - Scale mode
 * @param octave - Base octave
 * @param alteration - Chromatic alteration in semitones (optional)
 * @param octaveOffset - Additional octave offset (optional)

 * @returns Note name with octave (e.g., "E4") or null if invalid
 */
export function degreeToNote(
    degree: number,
    root: string,
    mode: ScaleMode,
    octave: number,
    alteration: number = 0,
    octaveOffset: number = 0
): NoteName | null {
    // Validate inputs
    if (!Number.isFinite(degree) || !Number.isFinite(octave)) return null;

    // Get scale mask
    const scaleMask = MODE_TO_SCALE[mode];
    if (scaleMask === undefined) return null;

    // Get scale intervals (24-EDO)
    const intervals24 = getScaleIntervals(scaleMask);
    if (intervals24.length === 0) return null;

    // Convert to 12-TET semitones
    const intervals = intervals24.map(i => Math.floor(Number(i) / 2));
    const scaleLen = intervals.length;

    // Parse root
    const rootSemitone = parseRoot(root);
    if (rootSemitone === null) return null;

    // Convert 1-indexed degree to 0-indexed
    const idx = degree - 1;

    // Handle octave wrapping for degrees outside base scale
    const baseIdx = ((idx % scaleLen) + scaleLen) % scaleLen;
    const octaveFromDegree = Math.floor(idx / scaleLen);

    // Calculate semitone from root
    const intervalSemitone = intervals[baseIdx];
    const totalSemitone = rootSemitone + intervalSemitone + alteration;

    // Calculate final octave and note
    const finalOctave = octave + octaveOffset + octaveFromDegree + Math.floor(totalSemitone / 12);
    const noteIdx = ((totalSemitone % 12) + 12) % 12;

    // Determine whether to use flats or sharps
    let useFlats = false;
    if (alteration < 0) {
        // Negative alteration (lowering) should use flats
        useFlats = true;
    } else if (root.includes('b')) {
        useFlats = true;
    } else if (mode === ScaleMode.MAJOR && FLAT_ROOTS.has(root)) {
        useFlats = true;
    } else if ((mode === ScaleMode.MINOR || mode === ScaleMode.DORIAN || mode === ScaleMode.PHRYGIAN) && FLAT_MINOR_ROOTS.has(root)) {
        useFlats = true;
    }

    const noteName = useFlats ? NOTE_NAMES_FLAT[noteIdx] : NOTE_NAMES_SHARP[noteIdx];

    return unsafeNoteName(`${noteName}${finalOctave}`);
}

/**
 * Get all notes in a scale for a given context.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param context - Scale context (root, mode, octave)

 * @returns Array of note names or null if invalid
 */
export function getScaleNotes(context: ScaleContext): NoteName[] | null {
    // Validate context
    if (!context || !context.root || !context.mode) return null;

    // Get scale mask
    const scaleMask = MODE_TO_SCALE[context.mode];
    if (scaleMask === undefined) return null;

    // Get scale intervals
    const intervals24 = getScaleIntervals(scaleMask);
    if (intervals24.length === 0) return null;

    // Convert each degree to a note
    const notes: NoteName[] = [];
    for (let i = 0; i < intervals24.length; i++) {
        const note = degreeToNote(i + 1, context.root, context.mode, context.octave);
        if (note === null) return null;
        notes.push(note);
    }

    return notes;
}

// ============================================================================
// SECTION 5: Scale Context Helpers
// ============================================================================

/**
 * Create a scale context.
 * COMPOSER-ONLY: Object creation.
 *
 * @param root - Root note string
 * @param mode - Scale mode
 * @param octave - Base octave

 * @returns ScaleContext or null if invalid
 */
export function createScaleContext(
    root: string,
    mode: ScaleMode,
    octave: number
): ScaleContext | null {
    if (parseRoot(root) === null) return null;
    if (MODE_TO_SCALE[mode] === undefined) return null;
    if (!Number.isFinite(octave)) return null;

    return { root, mode, octave };
}

/**
 * Get the number of notes in a scale mode.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param mode - Scale mode

 * @returns Number of notes or null if invalid mode
 */
export function getScaleModeSize(mode: ScaleMode): number | null {
    const scaleMask = MODE_TO_SCALE[mode];
    if (scaleMask === undefined) return null;

    return getScaleIntervals(scaleMask).length;
}
