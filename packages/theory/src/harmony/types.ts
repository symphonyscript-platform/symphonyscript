/**
 * RFC-047: Harmony Helper Types (24-EDO Native)
 *
 * Type definitions for progressions, voice leading, and harmony.
 */

// ============================================================================
// SECTION 1: Accidental Types
// ============================================================================

/**
 * Accidental type for note modification.
 */
export type Accidental = 'sharp' | 'flat' | 'natural';

// ============================================================================
// SECTION 2: Voice Leading Types
// ============================================================================

/**
 * Voice leading style options.
 */
export type VoiceLeadingStyle = 'close' | 'open' | 'drop2';

/**
 * Options for chord progression generation.
 */
export interface ProgressionOptions {
    /** Apply voice leading between chords */
    readonly voiceLead?: boolean;
    /** Voice leading style */
    readonly style?: VoiceLeadingStyle;
}

// ============================================================================
// SECTION 3: Scale Degree Types
// ============================================================================

/**
 * Scale degree with optional alterations.
 */
export interface ScaleDegree {
    /** Scale degree (1-7) */
    readonly degree: number;
    /** Chromatic alteration in semitones (-1 = flat, +1 = sharp) */
    readonly alteration?: number;
    /** Octave offset from base */
    readonly octaveOffset?: number;
}

// ============================================================================
// SECTION 4: Validation
// ============================================================================

/**
 * All valid accidentals.
 * KERNEL-SAFE: Frozen array.
 */
export const ACCIDENTALS: readonly Accidental[] = Object.freeze([
    'sharp', 'flat', 'natural'
]);

/**
 * All valid voice leading styles.
 * KERNEL-SAFE: Frozen array.
 */
export const VOICE_LEADING_STYLES: readonly VoiceLeadingStyle[] = Object.freeze([
    'close', 'open', 'drop2'
]);

/**
 * Check if a string is a valid accidental.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid Accidental
 */
export function isAccidental(value: string): value is Accidental {
    return ACCIDENTALS.includes(value as Accidental);
}

/**
 * Check if a string is a valid voice leading style.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid VoiceLeadingStyle
 */
export function isVoiceLeadingStyle(value: string): value is VoiceLeadingStyle {
    return VOICE_LEADING_STYLES.includes(value as VoiceLeadingStyle);
}
