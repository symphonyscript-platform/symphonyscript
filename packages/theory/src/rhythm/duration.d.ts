/**
 * RFC-047: Duration Utilities (24-EDO Native)
 *
 * Duration parsing and time signature utilities.
 * All functions use null returns instead of throws per RFC-058.
 */
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
/**
 * Duration constants for autocomplete.
 * KERNEL-SAFE: Frozen constants.
 */
export declare const DURATION: {
    readonly WHOLE: "1n";
    readonly HALF: "2n";
    readonly QUARTER: "4n";
    readonly EIGHTH: "8n";
    readonly SIXTEENTH: "16n";
    readonly THIRTY_SECOND: "32n";
    readonly DOTTED_WHOLE: "1n.";
    readonly DOTTED_HALF: "2n.";
    readonly DOTTED_QUARTER: "4n.";
    readonly DOTTED_EIGHTH: "8n.";
    readonly DOTTED_SIXTEENTH: "16n.";
    readonly HALF_TRIPLET: "2t";
    readonly QUARTER_TRIPLET: "4t";
    readonly EIGHTH_TRIPLET: "8t";
    readonly SIXTEENTH_TRIPLET: "16t";
};
/**
 * Convert beats to seconds at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param beats - Number of beats
 * @param bpm - Tempo in beats per minute
 * @returns Duration in seconds
 */
export declare function beatsToSeconds(beats: number, bpm: number): number;
/**
 * Convert seconds to beats at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param seconds - Duration in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Number of beats
 */
export declare function secondsToBeats(seconds: number, bpm: number): number;
/**
 * Parse time signature string to object.
 * KERNEL-SAFE: Returns null on invalid input (no throw).
 *
 * @param sig - Time signature string (e.g., '4/4', '3/4', '6/8')
 * @returns ParsedTimeSignature or null if invalid
 */
export declare function parseTimeSignature(sig: string): ParsedTimeSignature | null;
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
export declare function parseDuration(duration: NoteDuration): number | null;
/**
 * Get duration in beats, with fallback for invalid input.
 * KERNEL-SAFE: Pure lookup with fallback.
 *
 * @param duration - Duration notation or number
 * @param fallback - Fallback value if invalid (default 1.0 = quarter note)
 * @returns Duration in beats
 */
export declare function getDurationBeats(duration: NoteDuration, fallback?: number): number;
/**
 * Convert duration to milliseconds at given BPM.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param duration - Duration notation or number
 * @param bpm - Tempo in beats per minute
 * @returns Duration in milliseconds, or null if invalid
 */
export declare function durationToMs(duration: NoteDuration, bpm: number): number | null;
/**
 * Check if duration string is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - Value to check
 * @returns True if value is a valid duration
 */
export declare function isValidDuration(value: NoteDuration): boolean;
//# sourceMappingURL=duration.d.ts.map