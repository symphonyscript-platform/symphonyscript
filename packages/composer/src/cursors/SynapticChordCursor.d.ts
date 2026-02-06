import { SynapticMelodyBaseCursor } from './SynapticMelodyBaseCursor';
import { SynapticClip } from '../clips/SynapticClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { ArpPattern } from '../types';
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
    private _arpPattern;
    private _arpRate;
    private _arpGate;
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
     * Override arpeggio pattern for this chord.
     * @param pattern - Arpeggio pattern, or null to disable arpeggiation
     */
    arpeggio(pattern: ArpPattern | null): this;
    /**
     * Override arpeggio rate for this chord.
     * @param rate - Duration per arpeggiated note
     */
    arpeggioRate(rate: number): this;
    /**
     * Override arpeggio gate for this chord.
     * @param gate - Note duration multiplier (0-1)
     */
    arpeggioGate(gate: number): this;
    /**
     * Apply arpeggio pattern ordering to pitches.
     * @internal
     */
    private applyArpPattern;
    /**
     * Flushes the chord to kernel using inline bit iteration.
     * RFC-050: Delegates each voice to clip.flushNote() for transformation application.
     * Task 051: Resolves arpeggio settings and emits notes sequentially if arpeggiated.
     * STRICT ZERO-ALLOCATION. No closures.
     */
    commit(): void;
}
//# sourceMappingURL=SynapticChordCursor.d.ts.map