import { SynapticClip } from './SynapticClip';
import { SynapticDrumHitCursor } from '../cursors/SynapticDrumHitCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { EuclideanDrumOptions, DrumMap } from '../types';
import { euclidean, rotatePattern } from '@symphonyscript/theory';
import { parsePitch } from '../utils/pitch';

/**
 * Default drum mapping (GM Standard).
 * Maps drum names to MIDI note numbers.
 */
const DEFAULT_DRUM_MAP: DrumMap = {
    'kick': 36,      // C1
    'snare': 38,     // D1
    'hat': 42,       // F#1 (closed hi-hat)
    'openhat': 46,   // A#1
    'crash': 49,     // C#2
    'ride': 51,      // D#2
    'tom1': 48,      // C2
    'tom2': 45,      // A1
    'tom3': 43,      // G1
    'clap': 39,      // D#1
    'rim': 37,       // C#1
};

/**
 * SynapticDrums
 * RFC-049 Section 5.1
 * Builder for drum sequences with custom mapping support.
 */
export class SynapticDrums extends SynapticClip {
    private cursor: SynapticDrumHitCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;
    protected _drumMap: DrumMap = { ...DEFAULT_DRUM_MAP };

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.cursor = new SynapticDrumHitCursor(this, bridge);
    }

    /**
     * Create a new drum builder with custom mapping.
     * Merges provided mapping with existing map (overrides existing, adds new).
     * @param mapping - Custom drum name to pitch mapping
     * @returns this for chaining
     */
    withMapping(mapping: DrumMap): this {
        this._drumMap = { ...this._drumMap, ...mapping };
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
        const mapped = this._drumMap[name.toLowerCase()];
        if (mapped !== undefined) {
            return typeof mapped === 'number' ? mapped : parsePitch(mapped);
        }
        // Fallback: try to parse as pitch (e.g., 'C2')
        return parsePitch(name);
    }

    //========================
    // SynapticClip Implementation
    // ========================

    getCurrentTick(): number {
        return this.currentTick;
    }

    advanceTick(duration: number): void {
        this.currentTick += duration;
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
    hit(pitch: string | number, duration?: number): SynapticDrumHitCursor {
        const resolvedPitch = this.resolveDrumPitch(pitch);
        return this.cursor.hit(resolvedPitch, duration);
    }

    kick(duration?: number): SynapticDrumHitCursor {
        return this.hit('kick', duration);
    }

    snare(duration?: number): SynapticDrumHitCursor {
        return this.hit('snare', duration);
    }

    hat(duration?: number): SynapticDrumHitCursor {
        return this.hit('hat', duration);
    }

    clap(duration?: number): SynapticDrumHitCursor {
        return this.hit('clap', duration);
    }

    openHat(duration?: number): SynapticDrumHitCursor {
        return this.hit('openhat', duration);
    }

    crash(duration?: number): SynapticDrumHitCursor {
        return this.hit('crash', duration);
    }

    ride(duration?: number): SynapticDrumHitCursor {
        return this.hit('ride', duration);
    }

    tom(which: 1 | 2 | 3 = 1, duration?: number): SynapticDrumHitCursor {
        return this.hit(`tom${which}`, duration);
    }

    /**
     * Generate a Euclidean rhythm pattern with drum hits.
     * @param options - Euclidean rhythm options
     * @returns this for chaining
     */
    euclidean(options: EuclideanDrumOptions): this {
        const {
            hits,
            steps,
            drum,
            stepDuration,
            velocity = 0.8,
            rotation = 0,
            repeat = 1
        } = options;

        // Generate the Euclidean pattern
        let pattern = euclidean(hits, steps);
        if (!pattern) {
            throw new Error(`Invalid Euclidean parameters: hits=${hits}, steps=${steps}`);
        }

        // Apply rotation if specified
        if (rotation !== 0) {
            pattern = rotatePattern(pattern, rotation);
        }

        // Get the drum method
        const drumMethod = this.getDrumMethod(drum);

        for (let r = 0; r < repeat; r++) {
            for (const isHit of pattern) {
                if (isHit) {
                    drumMethod.call(this, stepDuration).velocity(velocity).commit();
                }
                this.advanceTick(stepDuration);
            }
        }

        return this;
    }

    /**
     * Get the drum method by name.
     * @internal
     */
    private getDrumMethod(drum: 'kick' | 'snare' | 'hat' | 'clap' | 'tom'): (duration?: number) => SynapticDrumHitCursor {
        // Use hit() with drum name to leverage custom mapping
        return (d?: number) => this.hit(drum === 'tom' ? 'tom1' : drum, d);
    }

    // Note: All escape methods (tempo, swing, etc.) are inherited from SynapticClip.
    // No empty overrides. SynapticClip base implementation handles state storage.
}
