/**
 * RFC-047: Tempo Types (24-EDO Native)
 *
 * Type definitions for tempo, curves, and envelopes.
 */
/**
 * Tempo transition curve types.
 */
export type TempoCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
/**
 * General easing curve types.
 */
export type EasingCurve = 'linear' | 'exponential' | 'logarithmic' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'smooth';
/**
 * Tempo keyframe for automation.
 */
export interface TempoKeyframe {
    /** Beat position */
    readonly beat: number;
    /** Tempo in BPM */
    readonly bpm: number;
    /** Transition curve to this keyframe */
    readonly curve?: TempoCurve;
}
/**
 * Tempo envelope with keyframes.
 */
export interface TempoEnvelope {
    /** Ordered keyframes */
    readonly keyframes: readonly TempoKeyframe[];
    /** Default tempo when no keyframes apply */
    readonly defaultBpm: number;
}
/**
 * All valid tempo curves.
 * KERNEL-SAFE: Frozen array.
 */
export declare const TEMPO_CURVES: readonly TempoCurve[];
/**
 * All valid easing curves.
 * KERNEL-SAFE: Frozen array.
 */
export declare const EASING_CURVES: readonly EasingCurve[];
/**
 * Check if a string is a valid tempo curve.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid TempoCurve
 */
export declare function isTempoCurve(value: string): value is TempoCurve;
/**
 * Check if a string is a valid easing curve.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid EasingCurve
 */
export declare function isEasingCurve(value: string): value is EasingCurve;
/**
 * Check if a tempo keyframe is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param keyframe - Keyframe to check
 * @returns True if valid TempoKeyframe
 */
export declare function isValidTempoKeyframe(keyframe: unknown): keyframe is TempoKeyframe;
/**
 * Create a tempo keyframe.
 * COMPOSER-ONLY: Object creation.
 *
 * @param beat - Beat position
 * @param bpm - Tempo in BPM
 * @param curve - Optional transition curve
 * @returns TempoKeyframe or null if invalid
 */
export declare function createTempoKeyframe(beat: number, bpm: number, curve?: TempoCurve): TempoKeyframe | null;
/**
 * Create a tempo envelope.
 * COMPOSER-ONLY: Object creation.
 *
 * @param keyframes - Array of keyframes
 * @param defaultBpm - Default tempo
 * @returns TempoEnvelope or null if invalid
 */
export declare function createTempoEnvelope(keyframes: readonly TempoKeyframe[], defaultBpm: number): TempoEnvelope | null;
//# sourceMappingURL=tempo.d.ts.map