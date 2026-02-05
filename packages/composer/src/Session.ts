/**
 * RFC-021: Session Class
 *
 * Manages multiple tracks and effect buses for complete musical compositions.
 */

import type {
    EffectType,
    EffectParamsFor,
    EffectBusConfig
} from '@symphonyscript/theory';
import {
    createEffectBusConfig,
    createInsertEffect,
    isEffectType
} from '@symphonyscript/theory';
import type { ClipNode, ClipBuilder, TrackNode, SessionNode } from './types';
import { SCHEMA_VERSION } from './types';
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
export class Session {
    private readonly sessionName: string;

    private sessionTempo: number | undefined;
    private sessionTimeSignature: [number, number] | undefined;
    private readonly tracks: TrackNode[] = [];
    private readonly buses: EffectBusConfig[] = [];

    /**
     * Private constructor - use Session.create() factory method.
     */
    private constructor(name?: string) {
        this.sessionName = name ?? '';
    }

    /**
     * Create a new Session.
     *
     * @param options - Optional session configuration
     * @returns New Session instance
     */
    static create(options?: SessionOptions): Session {
        return new Session(options?.name);
    }

    /**
     * Set the session tempo.
     *
     * @param bpm - Beats per minute (must be positive)
     * @returns this for chaining
     */
    tempo(bpm: number): this {
        if (!Number.isFinite(bpm) || bpm <= 0) {
            throw new Error('Session.tempo: bpm must be a positive number');
        }
        this.sessionTempo = bpm;
        return this;
    }

    /**
     * Set the session time signature.
     *
     * @param numerator - Beats per measure (must be positive integer)
     * @param denominator - Note value for one beat (must be power of 2)
     * @returns this for chaining
     */
    timeSignature(numerator: number, denominator: number): this {
        if (!Number.isInteger(numerator) || numerator <= 0) {
            throw new Error('Session.timeSignature: numerator must be a positive integer');
        }
        if (!Number.isInteger(denominator) || denominator <= 0) {
            throw new Error('Session.timeSignature: denominator must be a positive integer');
        }
        // Validate denominator is power of 2
        if ((denominator & (denominator - 1)) !== 0) {
            throw new Error('Session.timeSignature: denominator must be a power of 2');
        }
        this.sessionTimeSignature = [numerator, denominator];
        return this;
    }

    /**
     * Add a track to the session.
     *
     * @param track - Track instance or TrackNode to add
     * @returns this for chaining
     */
    add(track: Track | TrackNode): this {
        if (track === null || track === undefined) {
            throw new Error('Session.add: track is required');
        }

        const trackNode: TrackNode = this.isTrack(track)
            ? track.build()
            : track;

        this.tracks.push(trackNode);
        return this;
    }

    /**
     * Create and add a track inline.
     *
     * @param name - Track name
     * @param clip - ClipBuilder or ClipNode
     * @param instrument - Instrument identifier
     * @returns this for chaining
     */
    track(name: string, clip: ClipBuilder | ClipNode, instrument: string): this {
        if (typeof name !== 'string') {
            throw new Error('Session.track: name must be a string');
        }
        if (clip === null || clip === undefined) {
            throw new Error('Session.track: clip is required');
        }
        if (typeof instrument !== 'string' || instrument.length === 0) {
            throw new Error('Session.track: instrument must be a non-empty string');
        }

        const track = Track.from(clip, instrument, { name });
        this.tracks.push(track.build());
        return this;
    }

    /**
     * Define an effect bus.
     *
     * @param id - Bus identifier
     * @param type - Effect type for the bus
     * @param params - Effect-specific parameters
     * @returns this for chaining
     */
    bus<T extends EffectType>(id: string, type: T, params: EffectParamsFor<T>): this {
        if (typeof id !== 'string' || id.length === 0) {
            throw new Error('Session.bus: id must be a non-empty string');
        }
        if (!isEffectType(type)) {
            throw new Error(`Session.bus: invalid effect type "${type}"`);
        }

        // Create insert effect for the bus
        const effect = createInsertEffect(type, params);
        if (effect === null) {
            throw new Error(`Session.bus: failed to create effect "${type}"`);
        }

        // Create bus config with single effect
        const busConfig = createEffectBusConfig(id, [effect]);
        if (busConfig === null) {
            throw new Error(`Session.bus: failed to create bus "${id}"`);
        }

        this.buses.push(busConfig);
        return this;
    }

    /**
     * Build the SessionNode AST structure.
     *
     * @returns SessionNode ready for compilation/playback
     */
    build(): SessionNode {
        return {
            _version: SCHEMA_VERSION,
            kind: 'session',
            name: this.sessionName,
            tempo: this.sessionTempo,
            timeSignature: this.sessionTimeSignature,
            tracks: [...this.tracks],
            buses: [...this.buses]
        };
    }

    /**
     * Type guard to check if input is a Track instance.
     */
    private isTrack(input: Track | TrackNode): input is Track {
        return typeof (input as Track).build === 'function';
    }
}
