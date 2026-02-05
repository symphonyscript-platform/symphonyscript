/**
 * RFC-047: Harmony Helper Types (24-EDO Native)
 *
 * Type definitions for progressions, voice leading, and harmony.
 */
/**
 * Accidental type for note modification.
 */
export type Accidental = 'sharp' | 'flat' | 'natural';
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
/**
 * All valid accidentals.
 * KERNEL-SAFE: Frozen array.
 */
export declare const ACCIDENTALS: readonly Accidental[];
/**
 * All valid voice leading styles.
 * KERNEL-SAFE: Frozen array.
 */
export declare const VOICE_LEADING_STYLES: readonly VoiceLeadingStyle[];
/**
 * Check if a string is a valid accidental.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid Accidental
 */
export declare function isAccidental(value: string): value is Accidental;
/**
 * Check if a string is a valid voice leading style.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid VoiceLeadingStyle
 */
export declare function isVoiceLeadingStyle(value: string): value is VoiceLeadingStyle;
//# sourceMappingURL=types.d.ts.map