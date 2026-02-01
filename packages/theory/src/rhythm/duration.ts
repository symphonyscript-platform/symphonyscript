/**
 * RFC-047: Duration Utilities (24-EDO Native)
 *
 * Duration parsing and time signature utilities.
 * All functions use null returns instead of throws per RFC-058.
 */

// ============================================================================
// SECTION 1: Types
// ============================================================================

/**
 * Standard note duration strings.
 */
export type StandardDuration = '1n' | '2n' | '4n' | '8n' | '16n' | '32n';

/**
 * Dotted duration strings.
 */
export type DottedDuration = '1n.' | '2n.' | '4n.' | '8n.' | '16n.';

/**
 * Triplet duration strings.
 */
export type TripletDuration = '2t' | '4t' | '8t' | '16t';

/**
 * Note duration using musical notation or raw beats.
 */
export type NoteDuration = StandardDuration | DottedDuration | TripletDuration | number;

/**
 * Parsed time signature.
 */
export interface ParsedTimeSignature {
    readonly numerator: number;
    readonly denominator: number;
}

// ============================================================================
// SECTION 2: Duration Constants
// ============================================================================

/**
 * Base duration values in beats (where 1 beat = quarter note in 4/4).
 * KERNEL-SAFE: Frozen lookup table.
 */
const BASE_DURATIONS: Readonly<Record<string, number>> = Object.freeze({
    '1n': 4.0,    // Whole note = 4 beats
    '2n': 2.0,    // Half note = 2 beats
    '4n': 1.0,    // Quarter note = 1 beat
    '8n': 0.5,    // Eighth note = 0.5 beats
    '16n': 0.25,  // Sixteenth = 0.25 beats
    '32n': 0.125, // 32nd = 0.125 beats
});

/**
 * Duration constants for autocomplete.
 * KERNEL-SAFE: Frozen constants.
 */
export const DURATION = {
    // Standard
    WHOLE: '1n' as const,
    HALF: '2n' as const,
    QUARTER: '4n' as const,
    EIGHTH: '8n' as const,
    SIXTEENTH: '16n' as const,
    THIRTY_SECOND: '32n' as const,
    // Dotted
    DOTTED_WHOLE: '1n.' as const,
    DOTTED_HALF: '2n.' as const,
    DOTTED_QUARTER: '4n.' as const,
    DOTTED_EIGHTH: '8n.' as const,
    DOTTED_SIXTEENTH: '16n.' as const,
    // Triplet
    HALF_TRIPLET: '2t' as const,
    QUARTER_TRIPLET: '4t' as const,
    EIGHTH_TRIPLET: '8t' as const,
    SIXTEENTH_TRIPLET: '16t' as const,
} as const;

// ============================================================================
// SECTION 3: Time Conversion
// ============================================================================

/**
 * Convert beats to seconds at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param beats - Number of beats
 * @param bpm - Tempo in beats per minute
 * @returns Duration in seconds
 */
export function beatsToSeconds(beats: number, bpm: number): number {
    return beats * (60 / bpm);
}

/**
 * Convert seconds to beats at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param seconds - Duration in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Number of beats
 */
export function secondsToBeats(seconds: number, bpm: number): number {
    return seconds * (bpm / 60);
}

// ============================================================================
// SECTION 4: Time Signature Parsing
// ============================================================================

/**
 * Parse time signature string to object.
 * KERNEL-SAFE: Returns null on invalid input (no throw).
 *
 * @param sig - Time signature string (e.g., '4/4', '3/4', '6/8')
 * @returns ParsedTimeSignature or null if invalid
 */
export function parseTimeSignature(sig: string): ParsedTimeSignature | null {
    const parts = sig.split('/');
    if (parts.length !== 2) return null;

    const numerator = parseInt(parts[0], 10);
    const denominator = parseInt(parts[1], 10);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    if (numerator <= 0 || denominator <= 0) return null;

    return { numerator, denominator };
}

// ============================================================================
// SECTION 5: Duration Parsing
// ============================================================================

/**
 * Parse duration notation to beats.
 * KERNEL-SAFE: Returns null on invalid input (no throw).
 *
 * Supports:
 * - Standard: '4n' (quarter), '8n' (eighth), etc.
 * - Dotted: '4n.' (1.5× duration)
 * - Triplet: '4t' (⅔× duration)
 * - Numeric: Direct beat values
 *
 * Note: In 4/4 time, one beat = quarter note.
 *
 * @param duration - Duration notation or number
 * @returns Duration in beats, or null if invalid
 */
export function parseDuration(duration: NoteDuration): number | null {
    // Numeric duration - return directly if valid
    if (typeof duration === 'number') {
        if (!Number.isFinite(duration) || duration < 0) return null;
        return duration;
    }

    // Check for dotted notation (1.5× duration)
    if (duration.endsWith('.')) {
        const base = duration.slice(0, -1);
        const baseValue = BASE_DURATIONS[base];
        if (baseValue !== undefined) {
            return baseValue * 1.5;
        }
        return null;
    }

    // Check for triplet notation (⅔× duration)
    if (duration.endsWith('t')) {
        const base = duration.slice(0, -1) + 'n';
        const baseValue = BASE_DURATIONS[base];
        if (baseValue !== undefined) {
            return baseValue * (2 / 3);
        }
        return null;
    }

    // Standard notation
    const baseValue = BASE_DURATIONS[duration];
    if (baseValue !== undefined) {
        return baseValue;
    }

    return null;
}

/**
 * Get duration in beats, with fallback for invalid input.
 * KERNEL-SAFE: Pure lookup with fallback.
 *
 * @param duration - Duration notation or number
 * @param fallback - Fallback value if invalid (default 1.0 = quarter note)
 * @returns Duration in beats
 */
export function getDurationBeats(duration: NoteDuration, fallback: number = 1.0): number {
    const parsed = parseDuration(duration);
    return parsed ?? fallback;
}

/**
 * Convert duration to milliseconds at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param duration - Duration notation or number
 * @param bpm - Tempo in beats per minute
 * @returns Duration in milliseconds, or null if invalid
 */
export function durationToMs(duration: NoteDuration, bpm: number): number | null {
    const beats = parseDuration(duration);
    if (beats === null) return null;
    return beatsToSeconds(beats, bpm) * 1000;
}

/**
 * Check if duration string is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if value is a valid duration
 */
export function isValidDuration(value: NoteDuration): boolean {
    return parseDuration(value) !== null;
}
