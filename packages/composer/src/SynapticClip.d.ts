import type { SiliconBridge } from '@symphonyscript/kernel';
import { SynapticNode } from '@symphonyscript/synaptic';
/**
 * Parse pitch input to MIDI number.
 *
 * Supports:
 * - MIDI numbers: 60 → 60
 * - String notation: 'C4' → 60, 'D#4' → 63, 'Bb3' → 58
 *
 * @param input - MIDI number or string notation (e.g., 'C4', 'D#4', 'Bb3')
 * @returns MIDI note number (0-127)
 */
export declare function parsePitch(input: string | number): number;
/**
 * SynapticClip - Fluent DSL for building musical clips.
 *
 * Provides ergonomic, chainable API for composing music.
 * All methods return `this` for fluent chaining.
 */
export declare class SynapticClip {
    private builder;
    private bridge;
    private currentTick;
    private defaultDuration;
    private defaultVelocity;
    private pendingShift;
    private currentExpressionId;
    /**
     * Create a new SynapticClip.
     *
     * @param bridge - SiliconBridge instance from @symphonyscript/core
     */
    constructor(bridge: SiliconBridge);
    /**
     * Add a note to the clip.
     *
     * Supports both MIDI numbers (60) and string notation ('C4').
     * Advances currentTick by the note duration.
     *
     * @param pitch - MIDI number (60) or string notation ('C4', 'D#4', etc.)
     * @param duration - Duration in ticks (default: defaultDuration = 480)
     * @param velocity - MIDI velocity 0-127 (default: defaultVelocity = 100)
     * @returns this for fluent chaining
     */
    note(pitch: string | number, duration?: number, velocity?: number): this;
    /**
     * Add a rest (silence) to the clip.
     *
     * Advances currentTick without adding a note.
     *
     * @param duration - Duration in ticks (default: defaultDuration = 480)
     * @returns this for fluent chaining
     */
    rest(duration?: number): this;
    /**
     * Create a synaptic connection to another clip.
     *
     * Links this clip's exit to the target clip's entry.
     *
     * @param target - Target SynapticClipBuilder to link to
     * @param weight - Synapse weight 0-1000 (default: 500)
     * @param jitter - Timing jitter 0-65535 (default: 0)
     * @returns this for fluent chaining
     */
    play(target: SynapticClip, weight?: number, jitter?: number): this;
    /**
     * Get the underlying SynapticNode instance.
     *
     * @returns The wrapped SynapticNode
     */
    getNode(): SynapticNode;
    /**
     * Get the current tick position.
     *
     * @returns Current tick value
     */
    getCurrentTick(): number;
    /**
     * Stack (branch) independent voices for counterpoint.
     *
     * Creates PARALLEL execution: voices start at the SAME tick.
     * Per RFC-047 Section 3.2 "Model B: The Stack Graph".
     *
     * @param voiceBuilder - Callback that receives a new SynapticClip for the voice
     * @returns this for fluent chaining
     *
     * @example
     * const melody = Clip.clip('Counterpoint');
     *
     * melody
     *   .note('C4', 480)  // Main voice @ tick 0
     *   .stack((voice) => {
     *     voice.note('E4', 480);  // Voice 1 @ tick 480 (parallel)
     *   })
     *   .note('D4', 480);  // Main voice @ tick 480
     *
     * // Result: At tick 480, BOTH 'E4' and 'D4' play simultaneously
     */
    stack(voiceBuilder: (voice: SynapticClip) => void): this;
    /**
     * Tag voice with expression ID for MPE routing.
     *
     * Executes builder callback and tags all notes with expressionId.
     * Per RFC-047 brainstorming session requirements.
     *
     * @param expressionId - MPE expression ID (channel assignment)
     * @param builderFn - Callback to build notes for this voice
     * @returns this for fluent chaining
     *
     * @example
     * clip.stack(s => s
     *   .voice(1, v => v.note('C4'))  // MPE Channel 1
     *   .voice(2, v => v.note('E4'))  // MPE Channel 2
     * );
     */
    voice(expressionId: number, builderFn: (v: SynapticClip) => void): this;
    /**
     * Shift the next note's start time (micro-timing).
     *
     * Unlike rest(), shift() does NOT advance the cursor.
     * It offsets the next event's baseTick for humanization/groove.
     *
     * @param ticks - Offset in ticks (can be negative)
     * @returns this for fluent chaining
     *
     * @example
     * clip
     *   .note('C4', 480)
     *   .shift(20)           // Next note starts 20 ticks late
     *   .note('D4', 480);    // Slightly delayed for swing
     */
    shift(ticks: number): this;
    /**
     * Play a theoretical harmony mask with polyphonic MPE voice allocation.
     *
     * Uses pure integer arithmetic and bitwise masks from @symphonyscript/theory.
     * ZERO ALLOCATION per call.
     *
     * @param mask - 24-bit HarmonyMask integer
     * @param root - MIDI root pitch
     * @param duration - Duration in ticks (optional)
     * @returns this for fluent chaining
     */
    harmony(mask: number, root: number, duration?: number): this;
    /**
     * Set the phase-locking cycle length for this clip.
     *
     * @param ticks - Loop length in ticks. Use Infinity for linear time.
     * @returns this for fluent chaining
     */
    cycle(ticks: number): this;
}
//# sourceMappingURL=SynapticClip.d.ts.map