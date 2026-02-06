import { SynapticClip } from './SynapticClip';
import { SynapticMelodyNoteCursor } from '../cursors/SynapticMelodyNoteCursor';
import { SynapticChordCursor } from '../cursors/SynapticChordCursor';
import { FrozenClip } from './FrozenClip';
import { SiliconBridge } from '@symphonyscript/kernel';
import { ClipNode, EuclideanMelodyOptions, ArpeggioOptions, OperationsSource } from '../types';
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
     * Create a chord from scale degrees.
     * Requires scale() to be called first.
     * @param degrees - Array of scale degrees (1-7 for first octave, 8+ wraps to higher octaves)
     * @param duration - Optional chord duration
     * @returns SynapticChordCursor for further configuration
     * @throws Error if scale context is not set
     */
    degreeChord(degrees: number[], duration?: number): SynapticChordCursor;
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
     * Emit a voice-led chord progression from roman numerals.
     * Minimizes voice movement between successive chords.
     * Requires key() to be set first.
     * @param numerals - Array of roman numerals (e.g., ['I', 'IV', 'V', 'I'])
     * @param options - Optional configuration (duration per chord)
     * @returns this for chaining
     * @throws Error if key context is not set
     */
    voiceLead(numerals: string[], options?: {
        duration?: number;
    }): this;
    /**
     * Convert a chord symbol to an array of MIDI pitches.
     * @internal
     */
    private chordSymbolToPitches;
    /**
     * Find the voicing of a chord that minimizes total voice movement from previous chord.
     * Tries all inversions and picks the one with smallest sum of absolute pitch differences.
     * @internal
     */
    private findBestVoicing;
    /**
     * Calculate the total voice movement cost between two voicings.
     * Uses sum of absolute pitch differences.
     *
     * INTENTIONAL DIVERGENCE FROM THEORY PACKAGE:
     * - Theory version uses `HarmonyMask` (pitch-class only) for scale degree analysis.
     * - Composer version uses `number[]` (absolute pitch) for octave-aware voice leading.
     * - This distinction is intentional and critical for minimizing physical interval distance.
     *
     * @internal
     */
    private voiceMovementCost;
    /**
     * Emit a chord from an array of pitches.
     * @internal
     */
    private emitChordPitches;
    /**
     * Execute a builder function multiple times, or loop an OperationsSource.
     * Each iteration adds operations at the current tick position.
     * @param count - Number of repetitions
     * @param source - Builder function or OperationsSource to loop
     */
    loop(count: number, source: ((clip: SynapticMelody) => void) | OperationsSource): this;
    /**
     * Insert operations from another clip at current tick position.
     * @param clip - Source clip (SynapticMelody, ClipNode, FrozenClip, or OperationsSource)
     */
    play(clip: SynapticMelody | ClipNode | FrozenClip | OperationsSource): this;
    /**
     * Generate a Euclidean rhythm pattern with melodic notes.
     * @param options - Euclidean rhythm options
     * @returns this for chaining
     */
    euclidean(options: EuclideanMelodyOptions): this;
    /**
     * Play an arpeggio pattern over the given pitches.
     * @param pitches - Array of pitches (note names or MIDI numbers)
     * @param rate - Duration for each arpeggiated note
     * @param options - Arpeggio options (pattern, velocity, gate, octaves, seed)
     * @returns this for chaining
     */
    arpeggiate(pitches: (string | number)[], rate: number, options?: ArpeggioOptions): this;
    /**
     * Apply arpeggio pattern ordering to pitches.
     * @internal
     */
    private applyArpPattern;
    /**
     * Execute a builder function within an MPE voice scope.
     * All notes created inside the builder will be tagged with the expressionId.
     * @param id - Voice ID (1-15, MPE channel range)
     * @param builderFn - Builder function that creates notes for this voice
     * @returns this for chaining
     * @throws Error if id is out of range (1-15)
     */
    voice(id: number, builderFn: (v: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this;
    /**
     * Get the current expression ID (for voice scoping).
     */
    getExpressionId(): number | null;
    /**
     * Set the expression ID directly (for advanced use cases).
     * @param id - Expression ID (1-15) or null to clear
     */
    setExpressionId(id: number | null): this;
    /**
     * Execute a builder function in parallel (stacked) mode.
     * All operations inside the builder are placed at the SAME starting tick,
     * and the parent tick does NOT advance past the stacked content.
     *
     * Overloads:
     * - `stack()` - Enable polyphonic stacking mode (inherited from SynapticClip)
     * - `stack(builderFn)` - Execute builder in parallel
     *
     * @param builderFn - Builder function to execute in parallel
     * @returns this for chaining
     */
    stack(builderFn?: (b: SynapticMelody) => SynapticMelody | SynapticMelodyNoteCursor | void): this;
}
//# sourceMappingURL=SynapticMelody.d.ts.map