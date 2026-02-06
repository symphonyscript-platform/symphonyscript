import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from '../clips/SynapticClip';
import { ClipNode, AutomationTarget, ScopeIsolation, TempoKeyframe, ClipOperation } from '../types';
/**
 * Base SynapticCursor
 * RFC-049 Phase 1
 */
export declare abstract class SynapticCursor {
    protected clip: SynapticClip;
    protected bridge: SiliconBridge;
    hasPending: boolean;
    baseTick: number;
    protected _velocity: number;
    protected _duration: number;
    muted: boolean;
    protected humanizeAmount: number;
    protected _precise: boolean;
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
    /**
     * Escape: Define a multi-keyframe tempo envelope and return to clip.
     * @param keyframes - Array of tempo keyframes (minimum 2 required)
     */
    tempoEnvelope(keyframes: TempoKeyframe[]): SynapticClip;
    timeSignature(num: number, den: number): SynapticClip;
    swing(val: number): SynapticClip;
    groove(name: string): SynapticClip;
    /**
     * Escape: Send MIDI CC and return to clip.
     * @param controller - MIDI CC number (0-127)
     * @param value - CC value (0-127)
     */
    control(controller: number, value: number): SynapticClip;
    /**
     * Escape: Send MIDI Aftertouch and return to clip.
     * @param value - Pressure value (0-1, normalized)
     * @param options - Optional type ('channel' or 'poly') and note for poly aftertouch
     */
    aftertouch(value: number, options?: {
        type?: 'channel' | 'poly';
        note?: string | number;
    }): SynapticClip;
    /**
     * Escape: Send parameter automation and return to clip.
     * @param target - Automation target parameter
     * @param value - Target value
     * @param rampBeats - Duration to ramp (instant if undefined)
     * @param curve - Ramp curve type
     */
    automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: 'linear' | 'exponential' | 'smooth'): SynapticClip;
    /**
     * Escape: Set volume and return to clip.
     * @param value - Volume level (0-1)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    volume(value: number, rampBeats?: number): SynapticClip;
    /**
     * Escape: Set pan and return to clip.
     * @param value - Pan position (-1 = left, 0 = center, 1 = right)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    pan(value: number, rampBeats?: number): SynapticClip;
    /**
     * Escape: Execute isolated scope and return to clip.
     * @param options - Which state to isolate
     * @param builderFn - Builder function to execute in isolated scope
     */
    isolate(options: ScopeIsolation, builderFn: (b: SynapticClip) => SynapticClip | void): SynapticClip;
    /**
     * Escape: Enable polyphonic stacking mode.
     * Note: For stack(builderFn) parallel execution, use the clip method directly.
     */
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
    /**
     * Escape: Commit pending note and return operations array.
     * Enables fluent chaining: melody.note('C4', 1).toOperations()
     */
    toOperations(): ClipOperation[];
}
//# sourceMappingURL=SynapticCursor.d.ts.map