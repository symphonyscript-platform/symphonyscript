/**
 * RFC-047: Effects Types (DAW Layer)
 *
 * Type definitions for audio effects and routing.
 */

// ============================================================================
// SECTION 1: Effect Type Enum
// ============================================================================

/**
 * Available effect types.
 */
export type EffectType =
    | 'reverb'
    | 'delay'
    | 'chorus'
    | 'distortion'
    | 'compressor'
    | 'eq'
    | 'filter'
    | 'custom';

// ============================================================================
// SECTION 2: Base Effect Parameters
// ============================================================================

/**
 * Base parameters common to all effects.
 */
export interface BaseEffectParams {
    /** Bypass the effect */
    readonly bypass?: boolean;
    /** Wet/dry mix (0-1) */
    readonly wet?: number;
}

// ============================================================================
// SECTION 3: Specific Effect Parameters
// ============================================================================

/**
 * Reverb effect parameters.
 */
export interface ReverbParams extends BaseEffectParams {
    /** Room size (0-1) */
    readonly roomSize?: number;
    /** Decay time in seconds */
    readonly decay?: number;
}

/**
 * Delay effect parameters.
 */
export interface DelayParams extends BaseEffectParams {
    /** Delay time in seconds */
    readonly time?: number;
    /** Feedback amount (0-1) */
    readonly feedback?: number;
}

/**
 * Chorus effect parameters.
 */
export interface ChorusParams extends BaseEffectParams {
    /** LFO rate in Hz */
    readonly rate?: number;
    /** Modulation depth (0-1) */
    readonly depth?: number;
}

/**
 * Distortion effect parameters.
 */
export interface DistortionParams extends BaseEffectParams {
    /** Distortion amount (0-1) */
    readonly amount?: number;
}

/**
 * Compressor effect parameters.
 */
export interface CompressorParams extends BaseEffectParams {
    /** Threshold in dB */
    readonly threshold?: number;
    /** Compression ratio */
    readonly ratio?: number;
    /** Attack time in ms */
    readonly attack?: number;
    /** Release time in ms */
    readonly release?: number;
}

/**
 * EQ band configuration.
 */
export interface EqBand {
    /** Center frequency in Hz */
    readonly frequency: number;
    /** Gain in dB */
    readonly gain: number;
    /** Q factor (bandwidth) */
    readonly q?: number;
}

/**
 * EQ effect parameters.
 */
export interface EqParams extends BaseEffectParams {
    /** EQ bands */
    readonly bands?: readonly EqBand[];
}

/**
 * Filter type options.
 */
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/**
 * Filter effect parameters.
 */
export interface FilterParams extends BaseEffectParams {
    /** Filter type */
    readonly type?: FilterType;
    /** Cutoff frequency in Hz */
    readonly frequency?: number;
    /** Resonance/Q factor */
    readonly q?: number;
}

/**
 * Custom effect parameters (extensible).
 */
export interface CustomEffectParams extends BaseEffectParams {
    /** Custom parameters */
    readonly [key: string]: unknown;
}

// ============================================================================
// SECTION 4: Effect Parameter Mapping
// ============================================================================

/**
 * Map effect type to its parameter interface.
 */
export type EffectParamsFor<T extends EffectType> =
    T extends 'reverb' ? ReverbParams :
    T extends 'delay' ? DelayParams :
    T extends 'chorus' ? ChorusParams :
    T extends 'distortion' ? DistortionParams :
    T extends 'compressor' ? CompressorParams :
    T extends 'eq' ? EqParams :
    T extends 'filter' ? FilterParams :
    T extends 'custom' ? CustomEffectParams :
    BaseEffectParams;

// ============================================================================
// SECTION 5: Effect Routing Types
// ============================================================================

/**
 * Insert effect configuration.
 */
export interface InsertEffect<T extends EffectType = EffectType> {
    /** Effect type */
    readonly type: T;
    /** Effect parameters */
    readonly params: EffectParamsFor<T>;
}

/**
 * Send configuration for aux routing.
 */
export interface SendConfig {
    /** Target bus name */
    readonly bus: string;
    /** Send amount (0-1) */
    readonly amount: number;
}

/**
 * Effect bus configuration.
 */
export interface EffectBusConfig {
    /** Bus name */
    readonly name: string;
    /** Effects chain */
    readonly effects: readonly InsertEffect[];
}

// ============================================================================
// SECTION 6: Validation
// ============================================================================

/**
 * All valid effect types.
 * KERNEL-SAFE: Frozen array.
 */
export const EFFECT_TYPES: readonly EffectType[] = Object.freeze([
    'reverb', 'delay', 'chorus', 'distortion', 'compressor', 'eq', 'filter', 'custom'
]);

/**
 * All valid filter types.
 * KERNEL-SAFE: Frozen array.
 */
export const FILTER_TYPES: readonly FilterType[] = Object.freeze([
    'lowpass', 'highpass', 'bandpass'
]);

/**
 * Check if a string is a valid effect type.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check

 * @returns True if valid EffectType
 */
export function isEffectType(value: string): value is EffectType {
    return EFFECT_TYPES.includes(value as EffectType);
}

/**
 * Check if a string is a valid filter type.
 * KERNEL-SAFE: Pure check.
 *
 * @param value - String to check

 * @returns True if valid FilterType
 */
export function isFilterType(value: string): value is FilterType {
    return FILTER_TYPES.includes(value as FilterType);
}

// ============================================================================
// SECTION 7: Factory Functions
// ============================================================================

/**
 * Create an insert effect.
 * COMPOSER-ONLY: Object creation.
 *
 * @param type - Effect type
 * @param params - Effect parameters

 * @returns InsertEffect or null if invalid type
 */
export function createInsertEffect<T extends EffectType>(
    type: T,
    params: EffectParamsFor<T>
): InsertEffect<T> | null {
    if (!isEffectType(type)) return null;
    return { type, params };
}

/**
 * Create a send configuration.
 * COMPOSER-ONLY: Object creation.
 *
 * @param bus - Target bus name
 * @param amount - Send amount (0-1)

 * @returns SendConfig or null if invalid
 */
export function createSendConfig(bus: string, amount: number): SendConfig | null {
    if (typeof bus !== 'string' || bus.length === 0) return null;
    if (!Number.isFinite(amount) || amount < 0 || amount > 1) return null;
    return { bus, amount };
}

/**
 * Create an effect bus configuration.
 * COMPOSER-ONLY: Object creation.
 *
 * @param name - Bus name
 * @param effects - Effects chain

 * @returns EffectBusConfig or null if invalid
 */
export function createEffectBusConfig(
    name: string,
    effects: readonly InsertEffect[]
): EffectBusConfig | null {
    if (typeof name !== 'string' || name.length === 0) return null;
    if (!Array.isArray(effects)) return null;
    return { name, effects };
}
