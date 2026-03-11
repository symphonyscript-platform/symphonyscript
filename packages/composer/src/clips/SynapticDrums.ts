import { SynapticClip } from './SynapticClip';
import { DrumsHitCursor } from '../cursors/DrumsHitCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { EuclideanDrumOptions, DrumMap } from '../types';
import { euclidean, rotatePattern } from '@symphonyscript/theory';
import { parsePitch } from '../utils/pitch';

/** Standard drum slot indices (O(1) lookup). */
const enum DrumSlot {
    KICK = 0,
    SNARE = 1,
    HAT = 2,
    OPENHAT = 3,
    CRASH = 4,
    RIDE = 5,
    TOM1 = 6,
    TOM2 = 7,
    TOM3 = 8,
    CLAP = 9,
    RIM = 10,
}

/** Name to standard drum slot. Shared, no per-instance allocation. */
const STANDARD_DRUM_SLOT: Record<string, DrumSlot> = {
    kick: DrumSlot.KICK,
    snare: DrumSlot.SNARE,
    hat: DrumSlot.HAT,
    openhat: DrumSlot.OPENHAT,
    crash: DrumSlot.CRASH,
    ride: DrumSlot.RIDE,
    tom1: DrumSlot.TOM1,
    tom2: DrumSlot.TOM2,
    tom3: DrumSlot.TOM3,
    clap: DrumSlot.CLAP,
    rim: DrumSlot.RIM,
} as const;

/** Default GM pitches per slot. */
const DEFAULT_PITCHES = new Uint8Array([
    36, 38, 42, 46, 49, 51, 48, 45, 43, 39, 37,
]);

/**
 * SynapticDrums
 * RFC-049 Section 5.1
 * Builder for drum sequences with custom mapping support.
 */
export class SynapticDrums extends SynapticClip {
    private cursor: DrumsHitCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;
    /** Standard drums: O(1) array lookup. */
    private readonly _drumPitches: Uint8Array;
    /** Custom drum names. Lazily allocated only when needed. */
    private _customMap: Map<string, number> | null = null;

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.cursor = new DrumsHitCursor(this, bridge);
        this._drumPitches = new Uint8Array(DEFAULT_PITCHES);
    }

    /**
     * Create a new drum builder with custom mapping.
     * Mutates in place (no object spread).
     * @param mapping - Custom drum name to pitch mapping
     * @returns this for chaining
     */
    withMapping(mapping: DrumMap): this {
        for (const k in mapping) {
            if (!Object.prototype.hasOwnProperty.call(mapping, k)) continue;
            const raw = mapping[k];
            const pitch = typeof raw === 'number' ? raw : parsePitch(raw);
            const key = k.toLowerCase();
            const slot = STANDARD_DRUM_SLOT[key];
            if (slot !== undefined) {
                this._drumPitches[slot] = pitch;
            } else {
                (this._customMap ??= new Map()).set(key, pitch);
            }
        }
        return this;
    }

    /**
     * Resolve a drum name to MIDI pitch.
     * @param name - Drum name or pitch value
     * @returns MIDI note number
     */
    resolveDrumPitch(name: string | number): number {
        if (typeof name === 'number') {
            return name;
        }
        const key = name.toLowerCase();
        const slot = STANDARD_DRUM_SLOT[key];
        if (slot !== undefined) {
            return this._drumPitches[slot];
        }
        const custom = this._customMap?.get(key);
        if (custom !== undefined) {
            return custom;
        }
        return parsePitch(name);
    }

    //========================
    // SynapticClip Implementation
    // ========================

    getCurrentTick(): number {
        return this.currentTick;
    }

    advanceTick(duration: number): this {
        this.currentTick += duration;
        return this;
    }

    generateSourceId(): number {
        return this.sourceIdCounter++;
    }

    // ========================
    // Drum API Entry Points
    // ========================

    /**
     * Generic drum hit by name or pitch.
     * @param pitch - Drum name (from map) or MIDI pitch number
     * @param duration - Optional duration override
     */
    hit(pitch: string | number, duration?: number): DrumsHitCursor {
        const resolvedPitch = this.resolveDrumPitch(pitch);
        return this.cursor.hit(resolvedPitch, duration);
    }

    kick(duration?: number): DrumsHitCursor {
        return this.hit('kick', duration);
    }

    snare(duration?: number): DrumsHitCursor {
        return this.hit('snare', duration);
    }

    hat(duration?: number): DrumsHitCursor {
        return this.hit('hat', duration);
    }

    clap(duration?: number): DrumsHitCursor {
        return this.hit('clap', duration);
    }

    openHat(duration?: number): DrumsHitCursor {
        return this.hit('openhat', duration);
    }

    crash(duration?: number): DrumsHitCursor {
        return this.hit('crash', duration);
    }

    ride(duration?: number): DrumsHitCursor {
        return this.hit('ride', duration);
    }

    tom(which: 1 | 2 | 3 = 1, duration?: number): DrumsHitCursor {
        return this.hit(`tom${which}`, duration);
    }

    /**
     * Generate a Euclidean rhythm pattern with drum hits.
     * Supports both options object (for compatibility) and positional args (zero-allocation).
     * @param hitsOrOptions - Hit count or options object
     * @param steps - Steps (when using positional)
     * @param drum - Drum type (when using positional)
     * @param stepDuration - Step duration (when using positional)
     * @param velocity - Velocity 0-1 (when using positional)
     * @param rotation - Rotation offset (when using positional)
     * @param repeat - Repeat count (when using positional)
     */
    euclidean(
        hitsOrOptions: number | EuclideanDrumOptions,
        steps?: number,
        drum?: 'kick' | 'snare' | 'hat' | 'clap' | 'tom',
        stepDuration?: number,
        velocity?: number,
        rotation?: number,
        repeat?: number
    ): this {
        let hits: number;
        let stepsVal: number;
        let drumVal: 'kick' | 'snare' | 'hat' | 'clap' | 'tom';
        let stepDurationVal: number;
        let velocityVal: number;
        let rotationVal: number;
        let repeatVal: number;

        if (typeof hitsOrOptions === 'object') {
            const o = hitsOrOptions;
            hits = o.hits;
            stepsVal = o.steps;
            drumVal = o.drum;
            stepDurationVal = o.stepDuration;
            velocityVal = o.velocity ?? 0.8;
            rotationVal = o.rotation ?? 0;
            repeatVal = o.repeat ?? 1;
        } else {
            hits = hitsOrOptions;
            stepsVal = steps!;
            drumVal = drum!;
            stepDurationVal = stepDuration!;
            velocityVal = velocity ?? 0.8;
            rotationVal = rotation ?? 0;
            repeatVal = repeat ?? 1;
        }

        let pattern = euclidean(hits, stepsVal);
        if (!pattern) {
            throw new Error(`Invalid Euclidean parameters: hits=${hits}, steps=${stepsVal}`);
        }
        if (rotationVal !== 0) {
            pattern = rotatePattern(pattern, rotationVal);
        }

        const hitTarget = drumVal === 'tom' ? 'tom1' : drumVal;
        for (let r = 0; r < repeatVal; r++) {
            for (const isHit of pattern) {
                if (isHit) {
                    this.hit(hitTarget, stepDurationVal).velocity(velocityVal).commit();
                }
                this.advanceTick(stepDurationVal);
            }
        }
        return this;
    }

    // Note: All escape methods (tempo, swing, etc.) are inherited from SynapticClip.
}
