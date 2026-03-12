import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from '../clips/SynapticClip';
import { ClipNode, AutomationTarget, CurveType, ScopeIsolation, TempoKeyframe } from '../types';

/**
 * Base SynapticCursor
 * RFC-049 Phase 1
 */
export abstract class SynapticCursor {
    // State
    public hasPending: boolean = false;
    public baseTick: number = 0;
    protected _velocity: number = 0.8;
    protected _duration: number = 0.25; // Default 1/4 note
    public muted: boolean = false;
    protected humanizeAmount: number = 0; // 0 = precise, 1 = fully humanized
    protected _precise: boolean = false; // Task 031: Skip humanization for this note

    constructor(
        protected clip: SynapticClip,
        protected bridge: SiliconBridge
    ) { }

    /**
     * Rebinds the cursor to a new start time.
     * Called by the builder before configuring a new note.
     */
    bind(tick: number): this {
        this.baseTick = tick;
        return this;
    }

    /**
     * Flushes the pending state to the kernel.
     * MUST use zero-allocation logic (while loops, bitwise ops).
     */
    abstract commit(): void;

    // ==========================================
    // Modifiers (Fluently return this)
    // ==========================================

    velocity(val: number): this {
        this._velocity = val;
        return this;
    }

    duration(val: number): this {
        this._duration = val;
        return this;
    }

    staccato(): this {
        this._duration = 0.1; // Example stub logic
        return this;
    }

    legato(): this {
        this._duration = 1.0;
        return this;
    }

    accent(): this {
        this._velocity = Math.min(1.0, this._velocity + 0.2);
        return this;
    }

    tenuto(): this {
        this._duration = 1.0;
        this._velocity = Math.min(1.0, this._velocity + 0.1);
        return this;
    }

    marcato(): this {
        this._duration = 0.5;
        this._velocity = 1.0;
        return this;
    }

    humanize(amount: number = 0.1): this {
        // Apply subtle randomization to timing and velocity
        // amount controls the degree of humanization (0.0-1.0)
        this.humanizeAmount = Math.max(0, Math.min(1, amount));
        this._precise = false; // Disable precise mode when humanizing
        return this;
    }

    precise(): this {
        // Disable humanization for mechanical precision
        // Task 031: This flag is consumed by commit() and passed to flushNote()
        this._precise = true;
        return this;
    }

    // ==========================================
    // Escapes (Commit & Return Clip)
    // ==========================================

    _commit(): SynapticClip {
        if (this.hasPending) {
            this.commit();
        }
        return this.clip;
    }

    rest(duration?: number): SynapticClip {
        this._commit();
        return this.clip.rest(duration);
    }

    /**
     * Escape: Advance timeline and return to clip for fluent chaining.
     * @param ticks - Ticks to advance
     */
    advanceTick(ticks: number): SynapticClip {
        this._commit();
        return this.clip.advanceTick(ticks);
    }

    tempo(bpm: number): SynapticClip {
        this._commit();
        return this.clip.tempo(bpm);
    }

    /**
     * Escape: Define a multi-keyframe tempo envelope and return to clip.
     * @param keyframes - Array of tempo keyframes (minimum 2 required)
     */
    tempoEnvelope(keyframes: TempoKeyframe[]): SynapticClip {
        this._commit();
        return this.clip.tempoEnvelope(keyframes);
    }

    timeSignature(num: number, den: number): SynapticClip {
        this._commit();
        return this.clip.timeSignature(num, den);
    }

    swing(val: number): SynapticClip {
        this._commit();
        return this.clip.swing(val);
    }

    groove(name: string): SynapticClip {
        this._commit();
        return this.clip.groove(name);
    }

    /**
     * Escape: Set quantize and return to clip.
     * @param grid - Grid size in beats (e.g., 0.25 = 16th notes)
     * @param strength - Snap strength 0-1
     * @param duration - Quantize duration too
     */
    quantize(grid: number, strength?: number, duration?: boolean): SynapticClip {
        this._commit();
        return this.clip.quantize(grid, strength, duration);
    }

    /**
     * Escape: Start crescendo and return to clip.
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 0.4)
     * @param to - End velocity (default 1.0)
     * @param curve - Curve type (default LINEAR)
     */
    crescendo(duration: number, from?: number, to?: number, curve?: CurveType): SynapticClip {
        this._commit();
        return this.clip.crescendo(duration, from ?? 0.4, to ?? 1.0, curve ?? CurveType.LINEAR);
    }

    /**
     * Escape: Start decrescendo and return to clip.
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 1.0)
     * @param to - End velocity (default 0.4)
     * @param curve - Curve type (default LINEAR)
     */
    decrescendo(duration: number, from?: number, to?: number, curve?: CurveType): SynapticClip {
        this._commit();
        return this.clip.decrescendo(duration, from ?? 1.0, to ?? 0.4, curve ?? CurveType.LINEAR);
    }

    /**
     * Escape: Ramp velocity and return to clip.
     * @param to - Target velocity (0-1)
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 0.8)
     */
    velocityRamp(to: number, duration: number, from?: number): SynapticClip {
        this._commit();
        return this.clip.velocityRamp(to, duration, from ?? 0.8);
    }

    /**
     * Escape: Send MIDI CC and return to clip.
     * @param controller - MIDI CC number (0-127)
     * @param value - CC value (0-127)
     */
    control(controller: number, value: number): SynapticClip {
        this._commit();
        return this.clip.control(controller, value);
    }

    /**
     * Escape: Send MIDI Aftertouch and return to clip.
     * @param value - Pressure value (0-1, normalized)
     * @param note - Note for poly aftertouch (omit for channel)
     */
    aftertouch(value: number, note?: string | number): SynapticClip {
        this._commit();
        return this.clip.aftertouch(value, note);
    }

    /**
     * Escape: Send parameter automation and return to clip.
     * @param target - Automation target parameter
     * @param value - Target value
     * @param rampBeats - Duration to ramp (instant if undefined)
     * @param curve - Ramp curve type
     */
    automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: CurveType): SynapticClip {
        this._commit();
        return this.clip.automate(target, value, rampBeats, curve);
    }

    /**
     * Escape: Set volume and return to clip.
     * @param value - Volume level (0-1)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    volume(value: number, rampBeats?: number): SynapticClip {
        this._commit();
        return this.clip.volume(value, rampBeats);
    }

    /**
     * Escape: Set pan and return to clip.
     * @param value - Pan position (-1 = left, 0 = center, 1 = right)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    pan(value: number, rampBeats?: number): SynapticClip {
        this._commit();
        return this.clip.pan(value, rampBeats);
    }

    /**
     * Task 063: Delegate to clip.pushState (zero-allocation state stack).
     */
    pushState(options: ScopeIsolation): SynapticClip {
        this._commit();
        return this.clip.pushState(options);
    }

    /**
     * Task 063: Delegate to clip.popState.
     */
    popState(options: ScopeIsolation): SynapticClip {
        return this.clip.popState(options);
    }

    /**
     * Escape: Enable polyphonic stacking mode.
     * Note: For stack(builderFn) parallel execution, use the clip method directly.
     */
    stack(): SynapticClip {
        this._commit();
        return this.clip.stack();
    }

    setLoopRegion(start: number, end: number): SynapticClip {
        this._commit();
        return this.clip.setLoopRegion(start, end);
    }

    octave(n: number): SynapticClip {
        this._commit();
        return this.clip.octave(n);
    }

    octaveUp(n: number = 1): SynapticClip {
        this._commit();
        return this.clip.octaveUp(n);
    }

    octaveDown(n: number = 1): SynapticClip {
        this._commit();
        return this.clip.octaveDown(n);
    }

    /**
     * Escape: Commit pending note and build clip metadata.
     */
    build(): ClipNode {
        this._commit();
        return this.clip.build();
    }

    /**
     * Escape: Commit pending note and return operation snapshot (strict mode: empty).
     */
    toOperations(): ClipNode['operations'] {
        this._commit();
        return this.clip.toOperations();
    }

}
