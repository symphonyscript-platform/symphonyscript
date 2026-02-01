/**
 * RFC-047: Tempo Types (24-EDO Native)
 *
 * Type definitions for tempo, curves, and envelopes.
 */

// ============================================================================
// SECTION 1: Curve Types
// ============================================================================

/**
 * Tempo transition curve types.
 */
export type TempoCurve =
    | 'linear'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out';

/**
 * General easing curve types.
 */
export type EasingCurve =
    | 'linear'
    | 'exponential'
    | 'logarithmic'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out'
    | 'smooth';

// ============================================================================
// SECTION 2: Tempo Envelope Types
// ============================================================================

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

// ============================================================================
// SECTION 3: Validation
// ============================================================================

/**
 * All valid tempo curves.
 * KERNEL-SAFE: Frozen array.
 */
export const TEMPO_CURVES: readonly TempoCurve[] = Object.freeze([
    'linear', 'ease-in', 'ease-out', 'ease-in-out'
]);

/**
 * All valid easing curves.
 * KERNEL-SAFE: Frozen array.
 */
export const EASING_CURVES: readonly EasingCurve[] = Object.freeze([
    'linear', 'exponential', 'logarithmic', 'ease-in', 'ease-out', 'ease-in-out', 'smooth'
]);

/**
 * Check if a string is a valid tempo curve.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid TempoCurve
 */
export function isTempoCurve(value: string): value is TempoCurve {
    return TEMPO_CURVES.includes(value as TempoCurve);
}

/**
 * Check if a string is a valid easing curve.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check
 * @returns True if valid EasingCurve
 */
export function isEasingCurve(value: string): value is EasingCurve {
    return EASING_CURVES.includes(value as EasingCurve);
}

/**
 * Check if a tempo keyframe is valid.
 * KERNEL-SAFE: Pure check.
 *
 * @param keyframe - Keyframe to check
 * @returns True if valid TempoKeyframe
 */
export function isValidTempoKeyframe(keyframe: unknown): keyframe is TempoKeyframe {
    if (typeof keyframe !== 'object' || keyframe === null) return false;
    const kf = keyframe as Record<string, unknown>;
    if (typeof kf.beat !== 'number' || !Number.isFinite(kf.beat)) return false;
    if (typeof kf.bpm !== 'number' || !Number.isFinite(kf.bpm) || kf.bpm <= 0) return false;
    if (kf.curve !== undefined && !isTempoCurve(kf.curve as string)) return false;
    return true;
}

// ============================================================================
// SECTION 4: Factory Functions
// ============================================================================

/**
 * Create a tempo keyframe.
 * COMPOSER-ONLY: Object creation.
 *
 * @param beat - Beat position
 * @param bpm - Tempo in BPM
 * @param curve - Optional transition curve
 * @returns TempoKeyframe or null if invalid
 */
export function createTempoKeyframe(
    beat: number,
    bpm: number,
    curve?: TempoCurve
): TempoKeyframe | null {
    if (!Number.isFinite(beat) || beat < 0) return null;
    if (!Number.isFinite(bpm) || bpm <= 0) return null;
    if (curve !== undefined && !isTempoCurve(curve)) return null;

    return curve !== undefined
        ? { beat, bpm, curve }
        : { beat, bpm };
}

/**
 * Create a tempo envelope.
 * COMPOSER-ONLY: Object creation.
 *
 * @param keyframes - Array of keyframes
 * @param defaultBpm - Default tempo
 * @returns TempoEnvelope or null if invalid
 */
export function createTempoEnvelope(
    keyframes: readonly TempoKeyframe[],
    defaultBpm: number
): TempoEnvelope | null {
    if (!Number.isFinite(defaultBpm) || defaultBpm <= 0) return null;
    if (!Array.isArray(keyframes)) return null;

    for (const kf of keyframes) {
        if (!isValidTempoKeyframe(kf)) return null;
    }

    return { keyframes, defaultBpm };
}
