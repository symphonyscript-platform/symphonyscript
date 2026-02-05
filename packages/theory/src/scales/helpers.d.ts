/**
 * RFC-047: Scale Note Helpers (24-EDO Native)
 *
 * Functions for converting scale degrees to concrete note names.
 * Bridges the gap between abstract scale theory and playable notes.
 */
import type { NoteName } from '../pitch/notes';
/**
 * Scale mode names matching legacy system.
 */
export type ScaleMode = 'major' | 'minor' | 'harmonicMinor' | 'melodicMinor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'pentatonicMajor' | 'pentatonicMinor' | 'blues' | 'chromatic';
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
 * Parse root note to semitone offset (0-11).
 * KERNEL-SAFE: Returns null instead of throw.
 *
 * @param root - Root note string (e.g., "C", "F#", "Bb")
 * @returns Semitone offset (0-11) or null if invalid
 */
export declare function parseRoot(root: string): number | null;
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
export declare function degreeToNote(degree: number, root: string, mode: ScaleMode, octave: number, alteration?: number, octaveOffset?: number): NoteName | null;
/**
 * Get all notes in a scale for a given context.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param context - Scale context (root, mode, octave)
 * @returns Array of note names or null if invalid
 */
export declare function getScaleNotes(context: ScaleContext): NoteName[] | null;
/**
 * Create a scale context.
 * COMPOSER-ONLY: Object creation.
 *
 * @param root - Root note string
 * @param mode - Scale mode
 * @param octave - Base octave
 * @returns ScaleContext or null if invalid
 */
export declare function createScaleContext(root: string, mode: ScaleMode, octave: number): ScaleContext | null;
/**
 * Check if a mode is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param mode - Mode string to check
 * @returns True if valid ScaleMode
 */
export declare function isValidScaleMode(mode: string): mode is ScaleMode;
/**
 * Get all supported scale modes.
 * COMPOSER-ONLY: Creates array.
 *
 * @returns Array of scale mode names
 */
export declare function getSupportedScaleModes(): ScaleMode[];
/**
 * Get the number of notes in a scale mode.
 * KERNEL-SAFE: Pure lookup.
 *
 * @param mode - Scale mode
 * @returns Number of notes or null if invalid mode
 */
export declare function getScaleModeSize(mode: ScaleMode): number | null;
//# sourceMappingURL=helpers.d.ts.map