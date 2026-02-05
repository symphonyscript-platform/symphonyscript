/**
 * RFC-031: Beat-Grid Quantization
 *
 * Utilities for calculating beat and bar boundaries for synchronized updates.
 * All functions are KERNEL-SAFE (pure arithmetic, no allocation).
 */
/**
 * Quantize mode for timing synchronization.
 */
export type QuantizeMode = 'bar' | 'beat' | 'off';
/**
 * Time signature representation.
 */
export interface TimeSignature {
    readonly beatsPerMeasure: number;
    readonly beatUnit: number;
}
/**
 * Parse a time signature string into beats per measure.
 * KERNEL-SAFE: No allocation (returns null on invalid input).
 *
 * @param timeSignature - Time signature string (e.g., '4/4', '3/4', '6/8')
 * @returns TimeSignature object or null if invalid
 */
export declare function parseTimeSignature(timeSignature: string): TimeSignature | null;
/**
 * Get the next beat boundary from the current position.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position (can be fractional)
 * @returns Next whole beat number
 */
export declare function getNextBeat(currentBeat: number): number;
/**
 * Get the next bar boundary from the current position.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position (can be fractional)
 * @param beatsPerMeasure - Number of beats per measure (from time signature)
 * @returns Beat number at the start of the next bar
 */
export declare function getNextBarBeat(currentBeat: number, beatsPerMeasure: number): number;
/**
 * Get the current bar number (0-indexed).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Number of beats per measure
 * @returns Current bar number (0-indexed)
 */
export declare function getCurrentBar(currentBeat: number, beatsPerMeasure: number): number;
/**
 * Get the beat position within the current bar (0-indexed).
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Number of beats per measure
 * @returns Beat within current bar (0 to beatsPerMeasure-1)
 */
export declare function getBeatInBar(currentBeat: number, beatsPerMeasure: number): number;
/**
 * Calculate the target beat for a quantized update.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode ('bar', 'beat', or 'off')
 * @param beatsPerMeasure - Number of beats per measure
 * @returns Target beat for the update
 */
export declare function getQuantizeTargetBeat(currentBeat: number, mode: QuantizeMode, beatsPerMeasure: number): number;
/**
 * Convert beats to seconds.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param beats - Number of beats
 * @param bpm - Tempo in beats per minute
 * @returns Duration in seconds
 */
export declare function beatsToSeconds(beats: number, bpm: number): number;
/**
 * Convert seconds to beats.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param seconds - Duration in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Number of beats
 */
export declare function secondsToBeats(seconds: number, bpm: number): number;
/**
 * Get the duration of one beat in seconds.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param bpm - Tempo in beats per minute
 * @returns Beat duration in seconds
 */
export declare function getBeatDuration(bpm: number): number;
/**
 * Get the duration of one bar in seconds.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param bpm - Tempo in beats per minute
 * @param beatsPerMeasure - Number of beats per measure
 * @returns Bar duration in seconds
 */
export declare function getBarDuration(bpm: number, beatsPerMeasure: number): number;
/**
 * Check if a beat position is within the lookahead window.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param beat - Beat position to check
 * @param currentBeat - Current playback beat
 * @param lookaheadBeats - Lookahead window in beats
 * @returns True if beat is within lookahead window
 */
export declare function isWithinLookahead(beat: number, currentBeat: number, lookaheadBeats: number): boolean;
/**
 * Get the effective start beat for cancellation, respecting the lookahead window.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param requestedBeat - Beat at which user requested changes
 * @param currentBeat - Current playback beat
 * @param lookaheadBeats - Lookahead window in beats
 * @returns Effective beat from which to start cancellation
 */
export declare function getEffectiveCancelBeat(requestedBeat: number, currentBeat: number, lookaheadBeats: number): number;
/**
 * Calculate the current beat position from audio context state.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param audioTime - Current audio context time
 * @param playbackStartTime - Audio time when playback started
 * @param playbackStartBeat - Beat position when playback started
 * @param bpm - Current tempo
 * @returns Current beat position
 */
export declare function getCurrentBeatFromAudioTime(audioTime: number, playbackStartTime: number, playbackStartBeat: number, bpm: number): number;
/**
 * Calculate the audio time for a target beat.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param targetBeat - Target beat position
 * @param playbackStartTime - Audio time when playback started
 * @param playbackStartBeat - Beat position when playback started
 * @param bpm - Current tempo
 * @returns Audio time at target beat
 */
export declare function getAudioTimeForBeat(targetBeat: number, playbackStartTime: number, playbackStartBeat: number, bpm: number): number;
/**
 * Check if a beat position is exactly on a quantize boundary.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param beat - Beat position to check
 * @param mode - Quantize mode ('bar', 'beat', or 'off')
 * @param beatsPerMeasure - Number of beats per measure
 * @param tolerance - Tolerance for floating point comparison (default 0.001)
 * @returns True if on a quantize boundary
 */
export declare function isAtQuantizeBoundary(beat: number, mode: QuantizeMode, beatsPerMeasure: number, tolerance?: number): boolean;
/**
 * Get the time (in seconds) until the next quantize boundary.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Number of beats per measure
 * @param bpm - Tempo in beats per minute
 * @returns Time in seconds until next boundary (0 if mode is 'off')
 */
export declare function getTimeUntilNextQuantize(currentBeat: number, mode: QuantizeMode, beatsPerMeasure: number, bpm: number): number;
/**
 * Calculate the effective quantize boundary considering lookahead.
 * KERNEL-SAFE: Pure arithmetic.
 *
 * @param currentBeat - Current beat position
 * @param mode - Quantize mode
 * @param beatsPerMeasure - Number of beats per measure
 * @param lookaheadBeats - Lookahead window in beats
 * @returns Target beat for quantized update (after lookahead)
 */
export declare function getQuantizeTargetWithLookahead(currentBeat: number, mode: QuantizeMode, beatsPerMeasure: number, lookaheadBeats: number): number;
/**
 * Get information about the current position in the beat grid.
 * COMPOSER-ONLY: Returns object (allocation).
 *
 * @param currentBeat - Current beat position
 * @param beatsPerMeasure - Number of beats per measure
 * @returns Object with beat grid information
 */
export declare function getBeatGridInfo(currentBeat: number, beatsPerMeasure: number): {
    bar: number;
    beatInBar: number;
    fractionalBeat: number;
    isOnBeat: boolean;
    isOnBar: boolean;
    beatsUntilNextBar: number;
};
//# sourceMappingURL=quantize.d.ts.map