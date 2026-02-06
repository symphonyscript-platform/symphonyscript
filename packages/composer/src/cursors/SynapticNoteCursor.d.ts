import { SynapticCursor } from './SynapticCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
export declare class SynapticNoteCursor extends SynapticCursor {
    protected pitch: number;
    constructor(clip: SynapticClip, bridge: SiliconBridge);
    /**
     * Relay: Commits previous note (sequential) and starts new one.
     * @param input Pitch (string or midi number)
     * @param duration Optional duration in ticks
     */
    note(input: string | number, duration?: number): this;
    /**
     * Flushes the current single note to the clip mediator.
     * RFC-050: Delegates to clip.flushNote() for transformation application.
     */
    commit(): void;
}
//# sourceMappingURL=SynapticNoteCursor.d.ts.map