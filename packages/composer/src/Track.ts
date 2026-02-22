/**
 * RFC-020: Track Class
 *
 * Associates clips with instruments and effects for session composition.
 */

import type {
    EffectType,
    EffectParamsFor,
    InsertEffect,
    SendConfig
} from '@symphonyscript/theory';
import {
    createInsertEffect,
    createSendConfig,
    isEffectType
} from '@symphonyscript/theory';
import type { ClipNode, ClipBuilder, TrackNode } from './types';
import { SCHEMA_VERSION } from './types';

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
 * @design-time This class is intended for session setup only.
 * Do not call Track methods during playback hot paths.
 * Allocations (arrays, object literals) are acceptable during design-time.
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
export class Track {
    private readonly instrumentId: string;
    private readonly clipSource: ClipBuilder | ClipNode;
    private readonly trackName: string;

    private trackTempo: number | undefined;
    private trackTimeSignature: [number, number] | undefined;
    private readonly insertEffects: InsertEffect[] = [];
    private readonly sendConfigs: SendConfig[] = [];

    /**
     * Private constructor - use Track.from() factory method.
     */
    private constructor(
        instrument: string,
        clip: ClipBuilder | ClipNode,
        name?: string
    ) {
        if (typeof instrument !== 'string' || instrument.length === 0) {
            throw new Error('Track: instrument must be a non-empty string');
        }
        if (clip === null || clip === undefined) {
            throw new Error('Track: clip is required');
        }

        this.instrumentId = instrument;
        this.clipSource = clip;
        this.trackName = name ?? '';
    }

    /**
     * Create a Track from a clip and instrument.
     *
     * @param clip - ClipBuilder or ClipNode to use
     * @param instrument - Instrument identifier
     * @param options - Optional track configuration
     * @returns New Track instance
     */
    static from(
        clip: ClipBuilder | ClipNode,
        instrument: string,
        options?: TrackOptions
    ): Track {
        return new Track(instrument, clip, options?.name);
    }

    /**
     * Set the track tempo.
     *
     * @param bpm - Beats per minute (must be positive)
     * @returns this for chaining
     */
    tempo(bpm: number): this {
        if (!Number.isFinite(bpm) || bpm <= 0) {
            throw new Error('Track.tempo: bpm must be a positive number');
        }
        this.trackTempo = bpm;
        return this;
    }

    /**
     * Set the track time signature.
     *
     * @param numerator - Beats per measure (must be positive integer)
     * @param denominator - Note value for one beat (must be power of 2)
     * @returns this for chaining
     */
    timeSignature(numerator: number, denominator: number): this {
        if (!Number.isInteger(numerator) || numerator <= 0) {
            throw new Error('Track.timeSignature: numerator must be a positive integer');
        }
        if (!Number.isInteger(denominator) || denominator <= 0) {
            throw new Error('Track.timeSignature: denominator must be a positive integer');
        }
        // Validate denominator is power of 2
        if ((denominator & (denominator - 1)) !== 0) {
            throw new Error('Track.timeSignature: denominator must be a power of 2');
        }
        this.trackTimeSignature = [numerator, denominator];
        return this;
    }

    /**
     * Add an insert effect to the track.
     *
     * @param type - Effect type (reverb, delay, chorus, etc.)
     * @param params - Effect-specific parameters
     * @returns this for chaining
     */
    insert<T extends EffectType>(type: T, params: EffectParamsFor<T>): this {
        if (!isEffectType(type)) {
            throw new Error(`Track.insert: invalid effect type "${type}"`);
        }

        const effect = createInsertEffect(type, params);
        if (effect === null) {
            throw new Error(`Track.insert: failed to create effect "${type}"`);
        }

        this.insertEffects.push(effect);
        return this;
    }

    /**
     * Add a send routing to an aux bus.
     *
     * @param busId - Target bus identifier
     * @param amount - Send amount (0-1)
     * @returns this for chaining
     */
    send(busId: string, amount: number): this {
        const config = createSendConfig(busId, amount);
        if (config === null) {
            throw new Error(
                `Track.send: invalid bus "${busId}" or amount "${amount}" (must be 0-1)`
            );
        }

        this.sendConfigs.push(config);
        return this;
    }

    /**
     * Build the TrackNode AST structure.
     *
     * @returns TrackNode ready for session compilation
     */
    build(): TrackNode {
        // Resolve clip source to ClipNode
        const clipNode: ClipNode = this.isClipBuilder(this.clipSource)
            ? this.clipSource.build()
            : this.clipSource;

        return {
            _version: SCHEMA_VERSION,
            kind: 'track',
            name: this.trackName,
            instrumentId: this.instrumentId,
            clip: clipNode,
            tempo: this.trackTempo,
            timeSignature: this.trackTimeSignature,
            inserts: [...this.insertEffects],
            sends: [...this.sendConfigs]
        };
    }

    /**
     * Type guard to check if source is a ClipBuilder.
     */
    private isClipBuilder(source: ClipBuilder | ClipNode): source is ClipBuilder {
        return typeof (source as ClipBuilder).build === 'function';
    }
}
