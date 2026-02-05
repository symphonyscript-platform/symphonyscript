import { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from '../clips/SynapticClip';
import { ClipNode } from '../types';

/**
 * Base ComposerCursor
 * RFC-049 Phase 1
 */
export abstract class ComposerCursor {
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

    tempo(bpm: number): SynapticClip {
        this._commit();
        return this.clip.tempo(bpm);
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
     * Escape: Send MIDI CC and return to clip.
     * @param controller - MIDI CC number (0-127)
     * @param value - CC value (0-127)
     */
    control(controller: number, value: number): SynapticClip {
        this._commit();
        return this.clip.control(controller, value);
    }

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
     * Escape: Commit pending note and build the clip.
     * Enables fluent chaining: melody.note('C4', 1).build()
     */
    build(): ClipNode {
        this._commit();
        return this.clip.build();
    }
}
