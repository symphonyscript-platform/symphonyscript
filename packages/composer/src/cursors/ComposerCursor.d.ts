import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from '../clips/SynapticClip';
import { ClipNode } from '../types';
/**
 * Base ComposerCursor
 * RFC-049 Phase 1
 */
export declare abstract class ComposerCursor {
    protected clip: SynapticClip;
    protected bridge: SiliconBridge;
    hasPending: boolean;
    baseTick: number;
    protected _velocity: number;
    protected _duration: number;
    muted: boolean;
    protected humanizeAmount: number;
    constructor(clip: SynapticClip, bridge: SiliconBridge);
    /**
     * Rebinds the cursor to a new start time.
     * Called by the builder before configuring a new note.
     */
    bind(tick: number): this;
    /**
     * Flushes the pending state to the kernel.
     * MUST use zero-allocation logic (while loops, bitwise ops).
     */
    abstract commit(): void;
    velocity(val: number): this;
    duration(val: number): this;
    staccato(): this;
    legato(): this;
    accent(): this;
    tenuto(): this;
    marcato(): this;
    humanize(amount?: number): this;
    precise(): this;
    _commit(): SynapticClip;
    rest(duration?: number): SynapticClip;
    tempo(bpm: number): SynapticClip;
    timeSignature(num: number, den: number): SynapticClip;
    swing(val: number): SynapticClip;
    groove(name: string): SynapticClip;
    control(cc: number, val: number): SynapticClip;
    stack(): SynapticClip;
    setLoopRegion(start: number, end: number): SynapticClip;
    octave(n: number): SynapticClip;
    octaveUp(n?: number): SynapticClip;
    octaveDown(n?: number): SynapticClip;
    /**
     * Escape: Commit pending note and build the clip.
     * Enables fluent chaining: melody.note('C4', 1).build()
     */
    build(): ClipNode;
}
//# sourceMappingURL=ComposerCursor.d.ts.map