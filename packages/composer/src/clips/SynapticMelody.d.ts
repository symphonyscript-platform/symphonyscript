import { SynapticClip } from './SynapticClip';
import { SynapticMelodyNoteCursor } from '../cursors/SynapticMelodyNoteCursor';
import { SynapticChordCursor } from '../cursors/SynapticChordCursor';
import { SiliconBridge } from '@symphonyscript/kernel';
import { ClipNode } from '../types';
/**
 * SynapticMelody
 * RFC-049 Section 5.1
 * Refreshed melody builder with cursor architecture.
 */
export declare class SynapticMelody extends SynapticClip {
    private noteCursor;
    private chordCursor;
    private currentTick;
    private sourceIdCounter;
    constructor(bridge: SiliconBridge);
    getCurrentTick(): number;
    advanceTick(duration: number): void;
    generateSourceId(): number;
    note(input: string | number, duration?: number): SynapticMelodyNoteCursor;
    degree(deg: number, duration?: number, options?: import('../types').DegreeOptions): SynapticMelodyNoteCursor;
    chord(symbol: string): SynapticChordCursor;
    /**
     * Create a chord from a roman numeral in the current key context.
     * Requires key() to be set first.
     * @param numeral - Roman numeral (e.g., 'I', 'ii', 'V7', 'bVII')
     * @param duration - Optional chord duration
     * @returns SynapticChordCursor for further configuration
     * @throws Error if key context is not set
     */
    roman(numeral: string, duration?: number): SynapticChordCursor;
    /**
     * Emit a sequence of chords from roman numerals.
     * Requires key() to be set first.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param options - Optional configuration (duration per chord)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    progression(numerals: string[], options?: {
        duration?: number;
    }): this;
    /**
     * Execute a builder function multiple times.
     * Each iteration adds operations at the current tick position.
     * @param count - Number of repetitions
     * @param builderFn - Function that builds content for each iteration
     */
    loop(count: number, builderFn: (clip: SynapticMelody) => void): this;
    /**
     * Insert operations from another clip at current tick position.
     * @param clip - Source clip (SynapticMelody or ClipNode)
     */
    play(clip: SynapticMelody | ClipNode): this;
}
//# sourceMappingURL=SynapticMelody.d.ts.map