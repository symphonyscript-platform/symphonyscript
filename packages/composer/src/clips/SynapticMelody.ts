import { SynapticClip } from './SynapticClip';
import { SynapticMelodyNoteCursor } from '../cursors/SynapticMelodyNoteCursor';
import { SynapticChordCursor } from '../cursors/SynapticChordCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { ClipNode } from '../types';
import { romanToChord } from '../utils/romanAdapter';

/**
 * SynapticMelody
 * RFC-049 Section 5.1
 * Refreshed melody builder with cursor architecture.
 */
export class SynapticMelody extends SynapticClip {
    private noteCursor: SynapticMelodyNoteCursor;
    private chordCursor: SynapticChordCursor;
    private currentTick: number = 0;
    private sourceIdCounter: number = 0;

    constructor(bridge: SiliconBridge) {
        super(bridge);
        this.chordCursor = new SynapticChordCursor(this, bridge);
        this.noteCursor = new SynapticMelodyNoteCursor(this, bridge, this.chordCursor);
    }

    // ========================
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
    // Melody API Entry Points
    // ========================

    note(input: string | number, duration?: number): SynapticMelodyNoteCursor {
        return this.noteCursor.note(input, duration);
    }

    degree(deg: number, duration?: number, options?: import('../types').DegreeOptions): SynapticMelodyNoteCursor {
        return this.noteCursor.degree(deg, duration, options);
    }

    chord(symbol: string): SynapticChordCursor {
        return this.noteCursor.chord(symbol);
    }

    /**
     * Create a chord from a roman numeral in the current key context.
     * Requires key() to be set first.
     * @param numeral - Roman numeral (e.g., 'I', 'ii', 'V7', 'bVII')
     * @param duration - Optional chord duration
     * @returns SynapticChordCursor for further configuration
     * @throws Error if key context is not set
     */
    roman(numeral: string, duration?: number): SynapticChordCursor {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('roman() requires key() to be called first');
        }

        const chordSymbol = romanToChord(numeral, keyCtx);
        if (!chordSymbol) {
            throw new Error(`Invalid roman numeral: ${numeral}`);
        }

        const cursor = this.chord(chordSymbol);
        if (duration !== undefined) {
            cursor.duration(duration);
        }
        return cursor;
    }

    /**
     * Emit a sequence of chords from roman numerals.
     * Requires key() to be set first.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param options - Optional configuration (duration per chord)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    progression(numerals: string[], options?: { duration?: number }): this {
        const keyCtx = this.getKeyContext();
        if (!keyCtx) {
            throw new Error('progression() requires key() to be called first');
        }

        const duration = options?.duration ?? 1;

        for (const numeral of numerals) {
            const chordSymbol = romanToChord(numeral, keyCtx);
            if (!chordSymbol) {
                throw new Error(`Invalid roman numeral in progression: ${numeral}`);
            }

            this.chord(chordSymbol).duration(duration).commit();
            this.advanceTick(duration);
        }

        return this;
    }

    /**
     * Execute a builder function multiple times.
     * Each iteration adds operations at the current tick position.
     * @param count - Number of repetitions
     * @param builderFn - Function that builds content for each iteration
     */
    loop(count: number, builderFn: (clip: SynapticMelody) => void): this {
        for (let i = 0; i < count; i++) {
            builderFn(this);
        }
        return this;
    }

    /**
     * Insert operations from another clip at current tick position.
     * @param clip - Source clip (SynapticMelody or ClipNode)
     */
    play(clip: SynapticMelody | ClipNode): this {
        const source = 'build' in clip ? clip.build() : clip;

        // Replay each operation at current tick offset
        const tickOffset = this.getCurrentTick();
        for (const op of source.operations) {
            if (op.kind === 'note') {
                this.operations.push({
                    ...op,
                    tick: op.tick + tickOffset,
                    sourceId: this.generateSourceId()
                });
            }
        }

        // Advance tick by source clip duration
        const maxTick = source.operations.reduce(
            (max, op) => op.kind === 'note' ? Math.max(max, op.tick + op.duration) : max,
            0
        );
        this.advanceTick(maxTick);

        return this;
    }

    // Note: All escape methods (tempo, swing, transpose, etc.) are inherited from SynapticClip.
    // No empty overrides. SynapticClip base implementation handles state storage.
}
