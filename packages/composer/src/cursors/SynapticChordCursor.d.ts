import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
/**
 * SynapticChordCursor - Phase 5
 * Zero-allocation, bit-mask based chord handling.
 */
export declare class SynapticChordCursor extends SynapticMelodyBaseCursor {
    private readonly maxVoices;
    private readonly pitches;
    private readonly sourceIds;
    private chordMask;
    private chordRoot;
    constructor(clip: SynapticClip, bridge: SiliconBridge, maxVoices?: number);
    /**
     * Relay: Configures a chord from symbol.
     * Example: .chord('Cmaj7')
     */
    chord(symbol: string): this;
    /**
     * Relay: Harmony via raw mask.
     */
    harmony(mask: number, root?: number): this;
    /**
     * Modifier: Inversion via bitwise rotation.
     * Wraps notes that exceed 24 semitone range?
     * Simple logic: take bottom-most bit, move it +12.
     * Repeat 'steps' times.
     */
    inversion(steps: number): this;
    /**
     * Flushes the chord to kernel using inline bit iteration.
     * RFC-050: Delegates each voice to clip.flushNote() for transformation application.
     * STRICT ZERO-ALLOCATION. No closures.
     */
    commit(): void;
}
//# sourceMappingURL=SynapticChordCursor.d.ts.map