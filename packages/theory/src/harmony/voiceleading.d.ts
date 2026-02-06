/**
 * RFC-047: Voice Leading (24-EDO Native)
 *
 * Voice leading algorithms to minimize voice movement between chords.
 * Uses 24-EDO intervals instead of MIDI note names.
 */
import type { HarmonyMask, Interval24EDO } from '../types';
/**
 * Voice leading options.
 */
export interface VoiceLeadOptions {
    /** Number of voices (default: 4) */
    readonly voices?: number;
    /** Voicing style */
    readonly style?: 'close' | 'open' | 'drop2';
    /** Center octave for voicing (default: 4, i.e., middle C octave) */
    readonly centerOctave?: number;
}
/**
 * Voice movement from one pitch to another.
 */
export interface VoiceMovement {
    /** Starting pitch (24-EDO interval + octave offset) */
    readonly from: number;
    /** Target pitch (24-EDO interval + octave offset) */
    readonly to: number;
    /** Movement distance in 24-EDO steps */
    readonly distance: number;
}
/**
 * Calculate total voice movement distance between two chords.
 * KERNEL-SAFE: Zero allocation, pure bitwise arithmetic.
 *
 * Lower values indicate smoother voice leading.
 * Uses greedy matching to pair voices.
 *
 * @param fromMask - Starting chord mask
 * @param toMask - Target chord mask
 * @returns Total movement in 24-EDO steps
 */
export declare function voiceMovementCost(fromMask: HarmonyMask, toMask: HarmonyMask): number;
/**
 * Create a close voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches (24-EDO interval + octave × OCTAVE_SIZE)
 */
export declare function closeVoicing(mask: HarmonyMask, voices?: number, centerOctave?: number): number[];
/**
 * Create an open voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches
 */
export declare function openVoicing(mask: HarmonyMask, voices?: number, centerOctave?: number): number[];
/**
 * Create a drop-2 voicing for a chord mask.
 * COMPOSER-ONLY: Allocates array.
 *
 * Drop-2: Take the second-highest note and drop it an octave.
 *
 * @param mask - Chord mask
 * @param voices - Number of voices
 * @param centerOctave - Center octave (default: 4)
 * @returns Array of absolute pitches
 */
export declare function drop2Voicing(mask: HarmonyMask, voices?: number, centerOctave?: number): number[];
/**
 * Voice lead from one chord to another.
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param fromMask - Starting chord mask
 * @param toMask - Target chord mask
 * @param options - Voice leading options
 * @returns Array of voice movements
 */
export declare function voiceLead(fromMask: HarmonyMask, toMask: HarmonyMask, options?: VoiceLeadOptions): VoiceMovement[];
/**
 * Voice lead through a chord progression.
 * COMPOSER-ONLY: Allocates arrays.
 *
 * @param progression - Array of chord masks
 * @param options - Voice leading options
 * @returns Array of voicings (one per chord)
 */
export declare function voiceLeadProgression(progression: readonly HarmonyMask[], options?: VoiceLeadOptions): number[][];
/**
 * Convert absolute pitch to 24-EDO interval.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param pitch - Absolute pitch (interval + octave × OCTAVE_SIZE)
 * @returns 24-EDO interval (0-23)
 */
export declare function pitchToInterval(pitch: number): Interval24EDO;
/**
 * Get octave number from absolute pitch.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param pitch - Absolute pitch
 * @returns Octave number
 */
export declare function pitchToOctave(pitch: number): number;
/**
 * Create absolute pitch from interval and octave.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param interval - 24-EDO interval
 * @param octave - Octave number
 * @returns Absolute pitch
 */
export declare function createPitch(interval: Interval24EDO, octave: number): number;
//# sourceMappingURL=voiceleading.d.ts.map