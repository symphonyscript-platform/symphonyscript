import { ComposerCursor } from './ComposerCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
/**
 * SynapticDrumHitCursor
 * RFC-049 Section 4.6
 * Specialized for unpitched percussive events.
 */
export declare class SynapticDrumHitCursor extends ComposerCursor {
    protected drumPitch: number;
    protected isFlam: boolean;
    protected isDrag: boolean;
    constructor(clip: SynapticClip, bridge: SiliconBridge);
    ghost(): this;
    flam(): this;
    drag(): this;
    hit(pitch: number, duration?: number): this;
    kick(duration?: number): this;
    snare(duration?: number): this;
    hat(duration?: number): this;
    clap(duration?: number): this;
    openHat(duration?: number): this;
    crash(duration?: number): this;
    ride(duration?: number): this;
    tom(which?: 1 | 2 | 3, duration?: number): this;
    /**
     * Flushes the drum hit to the clip mediator with articulations.
     * RFC-050: Delegates all insertions to clip.flushNote().
     */
    commit(): void;
}
//# sourceMappingURL=SynapticDrumHitCursor.d.ts.map