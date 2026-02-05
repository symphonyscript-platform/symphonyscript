/**
 * RFC-020: Track Class
 *
 * Associates clips with instruments and effects for session composition.
 */
import type { EffectType, EffectParamsFor } from '@symphonyscript/theory';
import type { ClipNode, ClipBuilder, TrackNode } from './types';
/**
 * Track options for construction.
 */
export interface TrackOptions {
    /** Track name for identification */
    name?: string;
}
/**
 * Track class for associating clips with instruments and effects.
 *
 * Provides fluent API for:
 * - Setting tempo and time signature
 * - Adding insert effects
 * - Configuring send routing
 *
 * @example
 * ```typescript
 * const track = Track.from(clip, 'piano', { name: 'Lead' })
 *   .tempo(120)
 *   .timeSignature(4, 4)
 *   .insert('reverb', { roomSize: 0.5, decay: 2 })
 *   .send('delay-bus', 0.3)
 *   .build();
 * ```
 */
export declare class Track {
    private readonly instrumentId;
    private readonly clipSource;
    private readonly trackName;
    private trackTempo;
    private trackTimeSignature;
    private readonly insertEffects;
    private readonly sendConfigs;
    /**
     * Private constructor - use Track.from() factory method.
     */
    private constructor();
    /**
     * Create a Track from a clip and instrument.
     *
     * @param clip - ClipBuilder or ClipNode to use
     * @param instrument - Instrument identifier
     * @param options - Optional track configuration
     * @returns New Track instance
     */
    static from(clip: ClipBuilder | ClipNode, instrument: string, options?: TrackOptions): Track;
    /**
     * Set the track tempo.
     *
     * @param bpm - Beats per minute (must be positive)
     * @returns this for chaining
     */
    tempo(bpm: number): this;
    /**
     * Set the track time signature.
     *
     * @param numerator - Beats per measure (must be positive integer)
     * @param denominator - Note value for one beat (must be power of 2)
     * @returns this for chaining
     */
    timeSignature(numerator: number, denominator: number): this;
    /**
     * Add an insert effect to the track.
     *
     * @param type - Effect type (reverb, delay, chorus, etc.)
     * @param params - Effect-specific parameters
     * @returns this for chaining
     */
    insert<T extends EffectType>(type: T, params: EffectParamsFor<T>): this;
    /**
     * Add a send routing to an aux bus.
     *
     * @param busId - Target bus identifier
     * @param amount - Send amount (0-1)
     * @returns this for chaining
     */
    send(busId: string, amount: number): this;
    /**
     * Build the TrackNode AST structure.
     *
     * @returns TrackNode ready for session compilation
     */
    build(): TrackNode;
    /**
     * Type guard to check if source is a ClipBuilder.
     */
    private isClipBuilder;
}
//# sourceMappingURL=Track.d.ts.map