import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor'
import { MelodyChordCursor } from './MelodyChordCursor'
import { SynapticClip } from '../clips/SynapticClip'
import { SiliconBridge } from '@symphonyscript/kernel'
import { parsePitch } from '../utils/pitch'
import { applyKeySignature } from '../utils/key'
import { ArpPattern } from '../types'
import { SCALE_INTERVALS } from '../utils/scales'

/**
 * MelodyNoteCursor - Task 061 parallel hierarchy
 * Melody note cursor with key signature, degree, and chord relay support.
 */
export class MelodyNoteCursor extends SynapticMelodyBaseCursor {
    protected pitch: number = 60;
    private chordCursor: MelodyChordCursor;

    constructor(
        clip: SynapticClip,
        bridge: SiliconBridge,
        chordCursor: MelodyChordCursor
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
     * Applies key signature context for automatic accidentals.
     */
    note(input: string | number, duration?: number): this {
        if (this.hasPending) {
            this.commit();
            this.clip.advanceTick(this._duration);
        }

        this.bind(this.clip.getCurrentTick());

        // Apply key signature transformation for string input
        if (typeof input === 'string') {
            const keyContext = this.clip.getKeyContext();
            const accidentalOverride = this.clip.consumeAccidental();
            const transformedNote = applyKeySignature(input, keyContext, accidentalOverride);
            this.pitch = parsePitch(transformedNote);
        } else {
            // Numeric input - consume accidental without applying
            this.clip.consumeAccidental();
            this.pitch = input;
        }

        // Use explicit duration if provided, otherwise use clip's default duration
        if (duration !== undefined) {
            this._duration = duration;
        } else {
            this._duration = this.clip.getDefaultDuration();
        }
        this.hasPending = true;
        return this;
    }

    /**
     * Relay: Chord (Switches to ChordCursor)
     */
    chord(symbol: string): MelodyChordCursor {
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
     * @param octaveOffset - Octave shift (+1 = up, -1 = down)
     * @param alteration - Semitone alteration (+1 = sharp, -1 = flat)
     */
    degree(deg: number, duration?: number, octaveOffset?: number, alteration?: number): this {
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
        const oo = octaveOffset ?? 0;
        const alt = alteration ?? 0;

        this.pitch = rootPitch
            + intervals[scaleDegree]
            + (octaveShift + oo) * 12
            + alt;

        // Use explicit duration if provided, otherwise use clip's default duration
        if (duration !== undefined) {
            this._duration = duration;
        } else {
            this._duration = this.clip.getDefaultDuration();
        }
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

    arpeggio(pattern: ArpPattern | null): SynapticClip {
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
            this.expressionId,
            this._precise  // Task 031: Pass precise flag
        );

        this.hasPending = false;
        this._precise = false;  // Task 031: Reset after commit
    }
}
