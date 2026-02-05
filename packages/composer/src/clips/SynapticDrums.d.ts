import { SynapticClip } from './SynapticClip';
import { SynapticDrumHitCursor } from '../cursors/SynapticDrumHitCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
/**
 * SynapticDrums
 * RFC-049 Section 5.1
 * Builder for drum sequences.
 */
export declare class SynapticDrums extends SynapticClip {
    private cursor;
    private currentTick;
    private sourceIdCounter;
    constructor(bridge: SiliconBridge);
    getCurrentTick(): number;
    advanceTick(duration: number): void;
    generateSourceId(): number;
    kick(duration?: number): SynapticDrumHitCursor;
    snare(duration?: number): SynapticDrumHitCursor;
    hat(duration?: number): SynapticDrumHitCursor;
    clap(duration?: number): SynapticDrumHitCursor;
    hit(pitch: number, duration?: number): SynapticDrumHitCursor;
    openHat(duration?: number): SynapticDrumHitCursor;
    crash(duration?: number): SynapticDrumHitCursor;
    ride(duration?: number): SynapticDrumHitCursor;
    tom(which?: 1 | 2 | 3, duration?: number): SynapticDrumHitCursor;
}
//# sourceMappingURL=SynapticDrums.d.ts.map