import type { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticClip } from './SynapticClip';
/**
 * SynapticMelody - Extended DSL with musical theory features.
 *
 * Adds scale-based composition with degrees and chords.
 * Extends SynapticClipBuilder with additional musical intelligence.
 */
export declare class SynapticMelody extends SynapticClip {
    private currentOctave;
    private currentKey;
    private currentScale;
    /**
     * Create a new SynapticMelody.
     *
     * @param bridge - SiliconBridge instance from @symphonyscript/core
     */
    constructor(bridge: SiliconBridge);
    /**
     * Add a note using scale degree notation.
     *
     * Converts scale degree (1-7) to MIDI pitch based on current key,
     * scale, and octave. Degree 1 = tonic, 3 = third, 5 = fifth, etc.
     *
     * @param degree - Scale degree (1-7, or higher for extended octaves)
     * @param duration - Duration in ticks (default: 480)
     * @param velocity - MIDI velocity 0-127 (default: 100)
     * @returns this for fluent chaining
     */
    degree(degree: number, duration?: number, velocity?: number): this;
    /**
     * Add a chord using scale degree notation.
     *
     * Adds multiple notes simultaneously (same baseTick) based on
     * scale degrees. For example, chord([1, 3, 5]) creates a major triad.
     *
     * @param degrees - Array of scale degrees
     * @param duration - Duration in ticks (default: 480)
     * @param velocity - MIDI velocity 0-127 (default: 100)
     * @returns this for fluent chaining
     */
    chord(degrees: number[], duration?: number, velocity?: number): this;
    /**
     * Set the current octave for degree-based composition.
     *
     * @param octave - MIDI octave number (typically 3-5)
     * @returns this for fluent chaining
     */
    octave(octave: number): this;
    /**
     * Set the current key for degree-based composition.
     *
     * @param key - Key note name ('C', 'D', 'E', etc.)
     * @returns this for fluent chaining
     */
    key(key: string): this;
    /**
     * Set the current scale intervals.
     *
     * @param scale - Array of semitone intervals from root (e.g., [0, 2, 4, 5, 7, 9, 11] for major)
     * @returns this for fluent chaining
     */
    scale(scale: number[]): this;
    /**
     * Convert scale degree to MIDI pitch number.
     *
     * @param degree - Scale degree (1-based, can exceed scale length for higher octaves)
     * @returns MIDI pitch number
     */
    private degreeToMidi;
}
//# sourceMappingURL=SynapticMelody.d.ts.map