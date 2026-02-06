import { SynapticClip } from './SynapticClip';
import { SynapticDrumHitCursor } from '../cursors/SynapticDrumHitCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { EuclideanDrumOptions, DrumMap } from '../types';
/**
 * SynapticDrums
 * RFC-049 Section 5.1
 * Builder for drum sequences with custom mapping support.
 */
export declare class SynapticDrums extends SynapticClip {
    private cursor;
    private currentTick;
    private sourceIdCounter;
    protected _drumMap: DrumMap;
    constructor(bridge: SiliconBridge);
    /**
     * Create a new drum builder with custom mapping.
     * Merges provided mapping with existing map (overrides existing, adds new).
     * @param mapping - Custom drum name to pitch mapping
     * @returns this for chaining
     */
    withMapping(mapping: DrumMap): this;
    /**
     * Resolve a drum name to MIDI pitch.
     * @param name - Drum name or pitch value
     * @returns MIDI note number
     */
    resolveDrumPitch(name: string | number): number;
    getCurrentTick(): number;
    advanceTick(duration: number): void;
    generateSourceId(): number;
    /**
     * Generic drum hit by name or pitch.
     * @param pitch - Drum name (from map) or MIDI pitch number
     * @param duration - Optional duration override
     */
    hit(pitch: string | number, duration?: number): SynapticDrumHitCursor;
    kick(duration?: number): SynapticDrumHitCursor;
    snare(duration?: number): SynapticDrumHitCursor;
    hat(duration?: number): SynapticDrumHitCursor;
    clap(duration?: number): SynapticDrumHitCursor;
    openHat(duration?: number): SynapticDrumHitCursor;
    crash(duration?: number): SynapticDrumHitCursor;
    ride(duration?: number): SynapticDrumHitCursor;
    tom(which?: 1 | 2 | 3, duration?: number): SynapticDrumHitCursor;
    /**
     * Generate a Euclidean rhythm pattern with drum hits.
     * @param options - Euclidean rhythm options
     * @returns this for chaining
     */
    euclidean(options: EuclideanDrumOptions): this;
    /**
     * Get the drum method by name.
     * @internal
     */
    private getDrumMethod;
}
//# sourceMappingURL=SynapticDrums.d.ts.map