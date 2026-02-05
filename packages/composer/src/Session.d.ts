/**
 * RFC-021: Session Class
 *
 * Manages multiple tracks and effect buses for complete musical compositions.
 */
import type { EffectType, EffectParamsFor } from '@symphonyscript/theory';
import type { ClipNode, ClipBuilder, TrackNode, SessionNode } from './types';
import { Track } from './Track';
/**
 * Session options for construction.
 */
export interface SessionOptions {
    /** Session name for identification */
    name?: string;
}
/**
 * Session class for managing multiple tracks and effect buses.
 *
 * Provides fluent API for:
 * - Setting session-wide tempo and time signature
 * - Adding tracks (Track instances or TrackNodes)
 * - Creating inline tracks
 * - Defining effect buses
 *
 * @example
 * ```typescript
 * const session = Session.create({ name: 'My Song' })
 *   .tempo(120)
 *   .timeSignature(4, 4)
 *   .track('Lead', melody, 'piano')
 *   .track('Bass', bassline, 'bass')
 *   .bus('reverb-bus', 'reverb', { roomSize: 0.5 })
 *   .build();
 * ```
 */
export declare class Session {
    private readonly sessionName;
    private sessionTempo;
    private sessionTimeSignature;
    private readonly tracks;
    private readonly buses;
    /**
     * Private constructor - use Session.create() factory method.
     */
    private constructor();
    /**
     * Create a new Session.
     *
     * @param options - Optional session configuration
     * @returns New Session instance
     */
    static create(options?: SessionOptions): Session;
    /**
     * Set the session tempo.
     *
     * @param bpm - Beats per minute (must be positive)
     * @returns this for chaining
     */
    tempo(bpm: number): this;
    /**
     * Set the session time signature.
     *
     * @param numerator - Beats per measure (must be positive integer)
     * @param denominator - Note value for one beat (must be power of 2)
     * @returns this for chaining
     */
    timeSignature(numerator: number, denominator: number): this;
    /**
     * Add a track to the session.
     *
     * @param track - Track instance or TrackNode to add
     * @returns this for chaining
     */
    add(track: Track | TrackNode): this;
    /**
     * Create and add a track inline.
     *
     * @param name - Track name
     * @param clip - ClipBuilder or ClipNode
     * @param instrument - Instrument identifier
     * @returns this for chaining
     */
    track(name: string, clip: ClipBuilder | ClipNode, instrument: string): this;
    /**
     * Define an effect bus.
     *
     * @param id - Bus identifier
     * @param type - Effect type for the bus
     * @param params - Effect-specific parameters
     * @returns this for chaining
     */
    bus<T extends EffectType>(id: string, type: T, params: EffectParamsFor<T>): this;
    /**
     * Build the SessionNode AST structure.
     *
     * @returns SessionNode ready for compilation/playback
     */
    build(): SessionNode;
    /**
     * Type guard to check if input is a Track instance.
     */
    private isTrack;
}
//# sourceMappingURL=Session.d.ts.map