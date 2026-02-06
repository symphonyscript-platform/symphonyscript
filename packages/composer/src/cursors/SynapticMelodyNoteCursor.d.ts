import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor';
import { SynapticChordCursor } from './SynapticChordCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { DegreeOptions, ArpPattern } from '../types';
export declare class SynapticMelodyNoteCursor extends SynapticMelodyBaseCursor {
    protected pitch: number;
    private chordCursor;
    constructor(clip: SynapticClip, bridge: SiliconBridge, chordCursor: SynapticChordCursor);
    /**
     * Modifiers (Phase 4)
     */
    natural(): this;
    sharp(): this;
    flat(): this;
    /**
     * Relay: Note
     * Applies key signature context for automatic accidentals.
     */
    note(input: string | number, duration?: number): this;
    /**
     * Relay: Chord (Switches to ChordCursor)
     */
    chord(symbol: string): SynapticChordCursor;
    /**
     * Relay: Degree (Scale-based note)
     * Uses scale context from this.clip.getScaleContext().
     * @param deg - Scale degree (1-7 for first octave, 8+ wraps to higher octaves)
     * @param duration - Note duration
     * @param options - Optional octaveOffset and alteration
     */
    degree(deg: number, duration?: number, options?: DegreeOptions): this;
    transpose(semitones: number): SynapticClip;
    scale(scaleName: string): SynapticClip;
    arpeggio(pattern: ArpPattern | null): SynapticClip;
    vibrato(rate: number, depth: number): SynapticClip;
    /**
     * Flushes the current note to the clip mediator.
     * RFC-050: Delegates to clip.flushNote() for transformation application.
     */
    commit(): void;
}
//# sourceMappingURL=SynapticMelodyNoteCursor.d.ts.map