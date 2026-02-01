/**
 * RFC-047: Chord Progressions (24-EDO Native)
 *
 * Roman numeral parsing and chord progression utilities.
 * Returns HarmonyMask instead of string chord codes.
 */

import type { HarmonyMask, Interval24EDO } from '../types';
import { asHarmonyMask, asInterval24EDO } from '../types';
import { CHORD, CHORD_MAP } from '../chords';
import { INTERVAL, OCTAVE_SIZE } from '../constants';
import { transpose } from '../packer';

// ============================================================================
// SECTION 1: Types
// ============================================================================

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

// ============================================================================
// SECTION 2: Scale Constants
// ============================================================================

/**
 * Scale degree intervals for major scale (24-EDO).
 * Each step is doubled from 12-EDO (semitone × 2).
 */
const MAJOR_SCALE_INTERVALS: readonly Interval24EDO[] = [
    asInterval24EDO(0),   // 1 - Unison
    asInterval24EDO(4),   // 2 - Major second
    asInterval24EDO(8),   // 3 - Major third
    asInterval24EDO(10),  // 4 - Perfect fourth
    asInterval24EDO(14),  // 5 - Perfect fifth
    asInterval24EDO(18),  // 6 - Major sixth
    asInterval24EDO(22),  // 7 - Major seventh
];

/**
 * Scale degree intervals for natural minor scale (24-EDO).
 */
const MINOR_SCALE_INTERVALS: readonly Interval24EDO[] = [
    asInterval24EDO(0),   // 1 - Unison
    asInterval24EDO(4),   // 2 - Major second
    asInterval24EDO(6),   // 3 - Minor third
    asInterval24EDO(10),  // 4 - Perfect fourth
    asInterval24EDO(14),  // 5 - Perfect fifth
    asInterval24EDO(16),  // 6 - Minor sixth
    asInterval24EDO(20),  // 7 - Minor seventh
];

/**
 * Default chord qualities for each scale degree in major key.
 * I=maj, ii=m, iii=m, IV=maj, V=maj, vi=m, vii°=dim
 */
const MAJOR_DEGREE_QUALITIES: readonly string[] = [
    '', 'm', 'm', '', '', 'm', 'dim'
];

/**
 * Default chord qualities for each scale degree in minor key.
 * i=m, ii°=dim, III=maj, iv=m, v=m, VI=maj, VII=maj
 */
const MINOR_DEGREE_QUALITIES: readonly string[] = [
    'm', 'dim', '', 'm', 'm', '', ''
];

// ============================================================================
// SECTION 3: Roman Numeral Parsing
// ============================================================================

/**
 * Roman numeral to degree mapping.
 */
const ROMAN_TO_DEGREE: Readonly<Record<string, number>> = {
    'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7
};

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
export function parseRomanNumeral(
    numeral: string,
    mode: 'major' | 'minor'
): ParsedNumeral | null {
    if (!numeral || typeof numeral !== 'string') return null;

    let baseNumeral = numeral;
    let bass: number | undefined;
    let secondary: number | undefined;

    // Handle slash notation
    const slashIdx = numeral.indexOf('/');
    if (slashIdx !== -1) {
        const slashPart = numeral.slice(slashIdx + 1);
        baseNumeral = numeral.slice(0, slashIdx);

        // Check if slash part is a number (inversion) or roman numeral (secondary)
        if (/^\d+$/.test(slashPart)) {
            bass = parseInt(slashPart, 10);
        } else {
            // Secondary dominant - parse target
            const targetParsed = parseRomanNumeral(slashPart, mode);
            if (targetParsed === null) return null;
            secondary = targetParsed.degree;
        }
    }

    // Match roman numeral with optional b/# prefix
    // The suffix must be a valid chord quality (or empty)
    const validSuffixes = ['', '7', 'maj7', 'min7', 'm7', 'dim', 'dim7', 'aug', 'm7b5', 'ø', 'ø7', '°', '°7', 'sus4', 'sus2', 'sus', 'm', '+', 'δ', 'δ7'];

    // Use case-insensitive matching then validate
    const romanMatch = baseNumeral.match(/^(b|#)?([IViv]+)(.*)$/i);
    if (!romanMatch) return null;

    const accidentalStr = romanMatch[1];
    const romanPart = romanMatch[2];
    const suffix = romanMatch[3].toLowerCase();

    // Validate suffix is a known chord quality
    if (suffix && !validSuffixes.includes(suffix)) return null;

    // Convert roman to degree - must be exact match
    const romanLower = romanPart.toLowerCase();
    const degree = ROMAN_TO_DEGREE[romanLower];
    if (!degree) return null;

    // Validate that the roman numeral is well-formed (not something like "iiv" or "viii")
    const validRomanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
    if (!validRomanNumerals.includes(romanLower)) return null;

    // Determine accidental
    const accidental = accidentalStr === 'b' ? -1 : accidentalStr === '#' ? 1 : undefined;

    // Determine quality from case and suffix
    const isUppercase = romanPart === romanPart.toUpperCase();
    let quality: string;

    // Start with case-based default
    if (suffix) {
        // Explicit suffix overrides (e.g., dim, aug, maj7)
        quality = suffix;
    } else {
        // No explicit suffix - use case to determine major/minor
        // Uppercase = major (empty suffix), lowercase = minor ('m')
        // This takes precedence over mode defaults for explicit case
        quality = isUppercase ? '' : 'm';
    }

    return { degree, quality, accidental, secondary, bass };
}

// ============================================================================
// SECTION 4: Chord Mask Resolution
// ============================================================================

/**
 * Get the interval for a scale degree in a key.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @returns 24-EDO interval from key root
 */
export function getDegreeInterval(degree: number, key: KeyContext): Interval24EDO {
    const intervals = key.mode === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
    const idx = ((degree - 1) % 7 + 7) % 7;
    return intervals[idx];
}

/**
 * Get chord mask for a scale degree.
 * KERNEL-SAFE: Pure bitwise operations.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @param quality - Optional quality override
 * @returns Transposed chord mask
 */
export function degreeToMask(
    degree: number,
    key: KeyContext,
    quality?: string
): HarmonyMask {
    // Get default quality for this degree
    const defaults = key.mode === 'major' ? MAJOR_DEGREE_QUALITIES : MINOR_DEGREE_QUALITIES;
    const effectiveQuality = quality ?? defaults[((degree - 1) % 7 + 7) % 7] ?? '';

    // Look up chord mask from map first
    let baseMask: HarmonyMask = CHORD_MAP.get(effectiveQuality) ?? CHORD.MAJ;

    // If not found in map, try common quality mappings
    if (!CHORD_MAP.has(effectiveQuality)) {
        if (effectiveQuality === '7') baseMask = CHORD.DOM7;
        else if (effectiveQuality === 'm7') baseMask = CHORD.MIN7;
        else if (effectiveQuality === 'maj7') baseMask = CHORD.MAJ7;
        else if (effectiveQuality === 'dim') baseMask = CHORD.DIM;
        else if (effectiveQuality === 'dim7') baseMask = CHORD.DIM7;
        else if (effectiveQuality === 'aug') baseMask = CHORD.AUG;
        else if (effectiveQuality === 'm7b5' || effectiveQuality === 'ø') baseMask = CHORD.HALF_DIM;
        else if (effectiveQuality === 'sus4') baseMask = CHORD.SUS4;
        else if (effectiveQuality === 'sus2') baseMask = CHORD.SUS2;
        // else: keep default CHORD.MAJ
    }

    // Calculate transposition
    const degreeInterval = getDegreeInterval(degree, key);
    const totalTranspose = (Number(key.root) + Number(degreeInterval)) % OCTAVE_SIZE;

    return transpose(baseMask, asInterval24EDO(totalTranspose));
}

/**
 * Convert roman numeral to chord mask in key.
 * COMPOSER-ONLY: String parsing + mask lookup.
 *
 * @param numeral - Roman numeral string
 * @param key - Key context
 * @returns Chord mask or null if invalid
 */
export function romanToMask(numeral: string, key: KeyContext): HarmonyMask | null {
    if (!numeral || typeof numeral !== 'string') return null;

    const parsed = parseRomanNumeral(numeral, key.mode);
    if (parsed === null) return null;

    // Handle secondary dominants
    if (parsed.secondary !== undefined) {
        // Get the target chord's root interval
        const targetInterval = getDegreeInterval(parsed.secondary, key);
        const targetRoot = asInterval24EDO((Number(key.root) + Number(targetInterval)) % OCTAVE_SIZE);

        // Create temporary key context for the target
        const secondaryKey: KeyContext = { root: targetRoot, mode: 'major' };

        // Resolve chord in secondary key
        return degreeToMask(parsed.degree, secondaryKey, parsed.quality);
    }

    // Handle modal interchange (accidentals)
    let effectiveKey = key;
    if (parsed.accidental !== undefined) {
        // Shift the degree interval by the accidental
        const baseInterval = getDegreeInterval(parsed.degree, key);
        const shiftedRoot = asInterval24EDO(
            ((Number(key.root) + parsed.accidental * 2) % OCTAVE_SIZE + OCTAVE_SIZE) % OCTAVE_SIZE
        );
        effectiveKey = { root: shiftedRoot, mode: key.mode };
    }

    return degreeToMask(parsed.degree, effectiveKey, parsed.quality);
}

/**
 * Convert progression array to chord masks.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param numerals - Array of roman numerals
 * @param key - Key context
 * @returns Array of chord masks (null entries for invalid numerals)
 */
export function progressionToMasks(
    numerals: readonly string[],
    key: KeyContext
): (HarmonyMask | null)[] {
    return numerals.map(num => romanToMask(num, key));
}

// ============================================================================
// SECTION 5: Progression Presets
// ============================================================================

/**
 * Common chord progression presets.
 * KERNEL-SAFE: Frozen constants.
 */
export const PROGRESSION = {
    /** Pop: I - V - vi - IV */
    POP: Object.freeze(['I', 'V', 'vi', 'IV']),

    /** 12-Bar Blues */
    BLUES_12: Object.freeze([
        'I', 'I', 'I', 'I',
        'IV', 'IV', 'I', 'I',
        'V', 'IV', 'I', 'V'
    ]),

    /** Jazz ii-V-I */
    JAZZ_II_V_I: Object.freeze(['ii7', 'V7', 'Imaj7']),

    /** Jazz Turnaround */
    JAZZ_TURNAROUND: Object.freeze(['Imaj7', 'vi7', 'ii7', 'V7']),

    /** Andalusian Cadence */
    ANDALUSIAN: Object.freeze(['i', 'VII', 'VI', 'V']),

    /** 50s Progression */
    FIFTIES: Object.freeze(['I', 'vi', 'IV', 'V']),

    /** Pachelbel Canon */
    PACHELBEL: Object.freeze(['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V']),

    /** Axis of Awesome (same as POP but different order) */
    AXIS: Object.freeze(['I', 'V', 'vi', 'IV']),

    /** Royal Road (Japanese pop) */
    ROYAL_ROAD: Object.freeze(['IV', 'V', 'iii', 'vi']),

    /** Sensitive Female Chord Progression */
    SENSITIVE: Object.freeze(['vi', 'IV', 'I', 'V']),
} as const;

// ============================================================================
// SECTION 6: Key Context Helpers
// ============================================================================

/**
 * Create a key context from a root pitch class.
 * KERNEL-SAFE: Pure construction.
 *
 * @param root - Root pitch class (0-22, even numbers for standard notes)
 * @param mode - Major or minor
 * @returns KeyContext
 */
export function createKey(root: Interval24EDO, mode: 'major' | 'minor'): KeyContext {
    return { root, mode };
}

/**
 * Common key roots in 24-EDO.
 * KERNEL-SAFE: Frozen constants.
 */
export const KEY_ROOT = {
    C: asInterval24EDO(0),
    Cs: asInterval24EDO(2),
    Db: asInterval24EDO(2),
    D: asInterval24EDO(4),
    Ds: asInterval24EDO(6),
    Eb: asInterval24EDO(6),
    E: asInterval24EDO(8),
    F: asInterval24EDO(10),
    Fs: asInterval24EDO(12),
    Gb: asInterval24EDO(12),
    G: asInterval24EDO(14),
    Gs: asInterval24EDO(16),
    Ab: asInterval24EDO(16),
    A: asInterval24EDO(18),
    As: asInterval24EDO(20),
    Bb: asInterval24EDO(20),
    B: asInterval24EDO(22),
} as const;

// ============================================================================
// SECTION 7: String-based Progression Helpers
// ============================================================================

/**
 * Note names for 24-EDO pitch classes (using sharps).
 */
const PITCH_CLASS_TO_NOTE_SHARP: readonly string[] = [
    'C', 'C+', 'C#', 'C#+', 'D', 'D+', 'D#', 'D#+',
    'E', 'E+', 'F', 'F+', 'F#', 'F#+', 'G', 'G+',
    'G#', 'G#+', 'A', 'A+', 'A#', 'A#+', 'B', 'B+'
];

/**
 * Note names for 24-EDO pitch classes (using flats).
 */
const PITCH_CLASS_TO_NOTE_FLAT: readonly string[] = [
    'C', 'C+', 'Db', 'Db+', 'D', 'D+', 'Eb', 'Eb+',
    'E', 'E+', 'F', 'F+', 'Gb', 'Gb+', 'G', 'G+',
    'Ab', 'Ab+', 'A', 'A+', 'Bb', 'Bb+', 'B', 'B+'
];

/**
 * Keys that use flats in their key signature.
 */
const FLAT_KEY_ROOTS = new Set([2, 6, 10, 16, 20]); // Db, Eb, F, Ab, Bb (as 24-EDO)

/**
 * Get the root note string for a scale degree in a key.
 * COMPOSER-ONLY: String creation.
 *
 * @param degree - Scale degree (1-7)
 * @param key - Key context
 * @param accidentalOffset - Semitone offset for modal interchange (-1 or +1)
 * @returns Root note string (e.g., "G", "F#", "Bb") or null if invalid
 */
export function degreeToRoot(
    degree: number,
    key: KeyContext,
    accidentalOffset: number = 0
): string | null {
    if (degree < 1 || degree > 7) return null;

    // Get the interval for this degree
    const degreeInterval = getDegreeInterval(degree, key);

    // Calculate the pitch class (24-EDO)
    // accidentalOffset is in semitones, so multiply by 2 for 24-EDO
    const pitchClass24 = (
        Number(key.root) + Number(degreeInterval) + accidentalOffset * 2 + OCTAVE_SIZE
    ) % OCTAVE_SIZE;

    // Determine whether to use flats or sharps based on key
    const useFlats = FLAT_KEY_ROOTS.has(Number(key.root)) || accidentalOffset < 0;

    // Get note name (skip quarter tones - round to nearest semitone)
    const semitone = pitchClass24 & ~1; // Clear lowest bit to get semitone
    const noteNames = useFlats ? PITCH_CLASS_TO_NOTE_FLAT : PITCH_CLASS_TO_NOTE_SHARP;

    return noteNames[semitone] ?? null;
}

/**
 * Convert a roman numeral to a chord code string in a key.
 * COMPOSER-ONLY: String parsing and creation.
 *
 * @param numeral - Roman numeral (e.g., "V7", "bVII", "ii")
 * @param key - Key context
 * @returns Chord code string (e.g., "G7", "Bb", "Dm") or null if invalid
 */
export function romanToChord(numeral: string, key: KeyContext): string | null {
    const parsed = parseRomanNumeral(numeral, key.mode);
    if (parsed === null) return null;

    // Determine if the original numeral was lowercase (minor)
    // by checking the roman part of the numeral
    const romanMatch = numeral.match(/^[b#]?([IViv]+)/i);
    const isLowercase = romanMatch ? romanMatch[1] === romanMatch[1].toLowerCase() : false;

    // Handle secondary dominants
    if (parsed.secondary !== undefined) {
        // Get the target chord's root
        const targetRoot = degreeToRoot(parsed.secondary, key);
        if (targetRoot === null) return null;

        // Create temporary key context for the target (always major for secondary dominants)
        const targetPitchClass = KEY_ROOT[targetRoot as keyof typeof KEY_ROOT];
        if (targetPitchClass === undefined) {
            // Handle roots not in KEY_ROOT (like enharmonics)
            return null;
        }
        const secondaryKey: KeyContext = { root: targetPitchClass, mode: 'major' };

        // Get root of the secondary chord
        const root = degreeToRoot(parsed.degree, secondaryKey);
        if (root === null) return null;

        // Build chord code - combine case-based quality with suffix
        const suffix = buildChordSuffix(parsed.quality, isLowercase);
        return `${root}${suffix}`;
    }

    // Handle modal interchange (accidentals)
    const accidentalOffset = parsed.accidental ?? 0;
    const root = degreeToRoot(parsed.degree, key, accidentalOffset);
    if (root === null) return null;

    // Build chord code - combine case-based quality with suffix
    const suffix = buildChordSuffix(parsed.quality, isLowercase);
    return `${root}${suffix}`;
}

/**
 * Build the chord suffix from quality and case.
 * Combines implicit minor from lowercase with explicit suffix.
 */
function buildChordSuffix(quality: string, isLowercase: boolean): string {
    // If quality already contains 'm' or is a minor-related quality, use as-is
    if (quality === 'm' || quality.startsWith('m') || quality === 'dim' || quality.startsWith('dim')) {
        return quality;
    }

    // If lowercase numeral and quality is just a number suffix (7, 9, etc.)
    // or empty, prepend 'm' for minor
    if (isLowercase) {
        if (quality === '') {
            return 'm';
        }
        // For suffixes like '7', 'maj7', etc., check if it should be minor
        if (/^\d/.test(quality)) {
            return 'm' + quality; // ii7 -> m7
        }
    }

    return quality;
}

/**
 * Convert multiple roman numerals to chord code strings.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param numerals - Array of roman numerals
 * @param key - Key context
 * @returns Array of chord code strings (null entries for invalid numerals)
 */
export function progressionToChords(
    numerals: readonly string[],
    key: KeyContext
): (string | null)[] {
    return numerals.map(num => romanToChord(num, key));
}
