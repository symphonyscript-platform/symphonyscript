import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor';
import { SynapticChordCursor } from './SynapticChordCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { parsePitch } from '../utils/pitch';
import { DegreeOptions, ScaleMode } from '../types';

const SCALE_INTERVALS: Record<ScaleMode, number[]> = {
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    dorian:     [0, 2, 3, 5, 7, 9, 10],
    phrygian:   [0, 1, 3, 5, 7, 8, 10],
    lydian:     [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian:    [0, 1, 3, 5, 6, 8, 10]
};

export class SynapticMelodyNoteCursor extends SynapticMelodyBaseCursor {
    protected pitch: number = 60;
    private chordCursor: SynapticChordCursor;

    constructor(
        clip: SynapticClip,
        bridge: SiliconBridge,
        chordCursor: SynapticChordCursor
    ) {
        super(clip, bridge);
        this.chordCursor = chordCursor;
    }

    /**
     * Modifiers (Phase 4)
     */
    natural(): this {
        // Reset accidentals (no-op for now, could reset detune)
        this._detune = 0;
        return this;
    }

    sharp(): this { this.pitch += 1; return this; }
    flat(): this { this.pitch -= 1; return this; }

    /**
     * Relay: Note
     */
    note(input: string | number, duration?: number): this {
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }

        this.bind(this.clip.getCurrentTick());

        this.pitch = parsePitch(input);
        if (duration !== undefined) {
            this._duration = duration;
        }
        this.hasPending = true;
        return this;
    }

    /**
     * Relay: Chord (Switches to ChordCursor)
     */
    chord(symbol: string): SynapticChordCursor {
        // 1. Commit pending melody note
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }

        // ...
        const t = this.clip.getCurrentTick();
        this.chordCursor.bind(t);

        // 3. Delegate configuration and return chord cursor
        return this.chordCursor.chord(symbol);
    }

    /**
     * Relay: Degree (Scale-based note)
     * Uses scale context from this.clip.getScaleContext().
     * @param deg - Scale degree (1-7 for first octave, 8+ wraps to higher octaves)
     * @param duration - Note duration
     * @param options - Optional octaveOffset and alteration
     */
    degree(deg: number, duration?: number, options?: DegreeOptions): this {
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }
        this.bind(this.clip.getCurrentTick());

        const ctx = this.clip.getScaleContext();
        if (!ctx) {
            throw new Error('degree() requires setScale() to be called first');
        }

        const intervals = SCALE_INTERVALS[ctx.mode];
        const octaveShift = Math.floor((deg - 1) / 7);
        const scaleDegree = ((deg - 1) % 7 + 7) % 7; // Handle negative degrees

        const rootPitch = parsePitch(ctx.root + ctx.octave);
        const octaveOffset = options?.octaveOffset ?? 0;
        const alteration = options?.alteration ?? 0;

        this.pitch = rootPitch
            + intervals[scaleDegree]
            + (octaveShift + octaveOffset) * 12
            + alteration;

        if (duration !== undefined) this._duration = duration;
        this.hasPending = true;
        return this;
    }

    // ========================
    // Escapes (Commit & Return Clip)
    // ========================

    transpose(semitones: number): SynapticClip {
        this.commit();
        return this.clip.transpose(semitones);
    }

    scale(scaleName: string): SynapticClip {
        this.commit();
        return this.clip.scale(scaleName);
    }

    arpeggio(pattern: string): SynapticClip {
        this.commit();
        return this.clip.arpeggio(pattern);
    }

    vibrato(rate: number, depth: number): SynapticClip {
        this.commit();
        return this.clip.vibrato(rate, depth);
    }

    /**
     * Flushes the current note to the clip mediator.
     * RFC-050: Delegates to clip.flushNote() for transformation application.
     */
    commit(): void {
        if (!this.hasPending) return;

        const sourceId = this.clip.generateSourceId();

        this.clip.flushNote(
            this.pitch,
            this._velocity,
            this._duration,
            this.baseTick,
            this.muted,
            sourceId,
            this.expressionId
        );

        this.hasPending = false;
    }
}
