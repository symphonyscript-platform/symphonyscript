import { SynapticClip } from './SynapticClip';
import { SynapticDrumHitCursor } from '../cursors/SynapticDrumHitCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { EuclideanDrumOptions } from '../types';
import { euclidean, rotatePattern } from '@symphonyscript/theory';

/**
 * SynapticDrums
 * RFC-049 Section 5.1
 * Builder for drum sequences.
 */
export class SynapticDrums extends SynapticClip {
    private cursor: SynapticDrumHitCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.cursor = new SynapticDrumHitCursor(this, bridge);
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

    kick(duration?: number): SynapticDrumHitCursor {
        return this.cursor.kick(duration);
    }

    snare(duration?: number): SynapticDrumHitCursor {
        return this.cursor.snare(duration);
    }

    hat(duration?: number): SynapticDrumHitCursor {
        return this.cursor.hat(duration);
    }

    clap(duration?: number): SynapticDrumHitCursor {
        return this.cursor.clap(duration);
    }

    hit(pitch: number, duration?: number): SynapticDrumHitCursor {
        return this.cursor.hit(pitch, duration);
    }

    openHat(duration?: number): SynapticDrumHitCursor {
        return this.cursor.openHat(duration);
    }

    crash(duration?: number): SynapticDrumHitCursor {
        return this.cursor.crash(duration);
    }

    ride(duration?: number): SynapticDrumHitCursor {
        return this.cursor.ride(duration);
    }

    tom(which: 1 | 2 | 3 = 1, duration?: number): SynapticDrumHitCursor {
        return this.cursor.tom(which, duration);
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
        switch (drum) {
            case 'kick': return this.kick;
            case 'snare': return this.snare;
            case 'hat': return this.hat;
            case 'clap': return this.clap;
            case 'tom': return (d?: number) => this.tom(1, d);
        }
    }

    // Note: All escape methods (tempo, swing, etc.) are inherited from SynapticClip.
    // No empty overrides. SynapticClip base implementation handles state storage.
}
