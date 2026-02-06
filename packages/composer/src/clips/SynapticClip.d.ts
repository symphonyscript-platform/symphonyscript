import { SiliconBridge } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { SynapticNode } from '@symphonyscript/synaptic';
import { ClipNode, NoteOperation, ScaleContext, ScaleMode, KeyContext, Accidental, DynamicsOp, VelocityPoint, HumanizeSettings, QuantizeSettings, CCOperation, AftertouchOperation, AutomationOperation, AutomationTarget, FreezeOptions, ScopeIsolation, ScopeOp, TempoKeyframe, TempoEnvelopeOp, ClipOperation, ArpPattern, PitchBendOperation } from '../types';
import { FrozenClip } from './FrozenClip';
/**
 * SynapticClip - Orchestration Logic for Neural Audio Clippings.
 *
 * ALLOCATION POLICY:
 * - This class runs on the MAIN THREAD (Composer Layer).
 * - Maps, Arrays, and Object allocations are PERMITTED.
 * - This layer compiles user intent into a zero-allocation format.
 *
 * "KERNEL-SAFE" DEFINITION:
 * - Methods marked KERNEL-SAFE refer to OUTPUT FORMAT compatibility.
 * - They do NOT imply thread safety or real-time constraints.
 *
 * CLARIFICATION:
 * - Actual audio-thread-safe zero-allocation operations reside in `@symphonyscript/kernel`.
 */
export declare abstract class SynapticClip extends SynapticNode {
    protected clipName: string;
    protected operations: (NoteOperation | CCOperation | AftertouchOperation | AutomationOperation | ScopeOp | TempoEnvelopeOp | PitchBendOperation)[];
    protected scaleContext: ScaleContext | null;
    protected keyContext: KeyContext | null;
    protected nextAccidental: Accidental | null;
    protected transposeOffset: number;
    protected currentScale: string | null;
    protected _arpeggioPattern: ArpPattern | null;
    protected _arpeggioRate: number;
    protected _arpeggioGate: number;
    protected vibratoRate: number;
    protected vibratoDepth: number;
    protected currentTempo: number;
    protected timeSignatureNumerator: number;
    protected timeSignatureDenominator: number;
    protected swingAmount: number;
    protected currentGroove: string | null;
    protected ccAutomation: Map<number, number>;
    protected stackingEnabled: boolean;
    protected loopEnabled: boolean;
    protected loopStart: number;
    protected loopEnd: number;
    protected humanizeRng: SeededRandom;
    protected activeDynamics: DynamicsOp | null;
    protected dynamicsStartTick: number;
    protected velocityCurvePoints: VelocityPoint[] | null;
    protected _defaultDuration: number | null;
    protected _humanizeSettings: HumanizeSettings | null;
    protected _quantizeSettings: QuantizeSettings | null;
    protected _expressionId: number | null;
    constructor(bridge: SiliconBridge, seed?: number);
    abstract getCurrentTick(): number;
    abstract advanceTick(ticks: number): void;
    abstract generateSourceId(): number;
    rest(duration?: number): this;
    tempo(bpm: number): this;
    /**
     * Define a multi-keyframe tempo envelope.
     * Allows gradual tempo transitions over time with different curve types.
     * @param keyframes - Array of tempo keyframes (minimum 2 required)
     * @returns this for chaining
     * @throws Error if fewer than 2 keyframes provided
     */
    tempoEnvelope(keyframes: TempoKeyframe[]): this;
    timeSignature(numerator: number, denominator: number): this;
    swing(val: number): this;
    groove(name: string): this;
    /**
     * Send a MIDI Control Change message at the current tick.
     * @param controller - MIDI CC number (0-127)
     * @param value - CC value (0-127)
     * @throws Error if controller or value is out of range
     */
    control(controller: number, value: number): this;
    /**
     * Send a MIDI Aftertouch (pressure) message at the current tick.
     * @param value - Pressure value (0-1, normalized)
     * @param options - Optional type ('channel' or 'poly') and note for poly aftertouch
     * @throws Error if value is out of range or poly aftertouch missing note
     */
    aftertouch(value: number, options?: {
        type?: 'channel' | 'poly';
        note?: string | number;
    }): this;
    /**
     * Send a parameter automation message at the current tick.
     * @param target - Automation target parameter
     * @param value - Target value (volume: 0-1, pan: -1 to 1, others: 0-1)
     * @param rampBeats - Duration to ramp to value (instant if undefined)
     * @param curve - Ramp curve type (default: 'linear')
     * @throws Error if value is out of range for the target
     */
    automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: 'linear' | 'exponential' | 'smooth'): this;
    /**
     * Shorthand for volume automation.
     * @param value - Volume level (0-1)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    volume(value: number, rampBeats?: number): this;
    /**
     * Shorthand for pan automation.
     * @param value - Pan position (-1 = left, 0 = center, 1 = right)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    pan(value: number, rampBeats?: number): this;
    stack(): this;
    setLoopRegion(start: number, end: number): this;
    transpose(semitones: number): this;
    /**
     * Set absolute octave context.
     * @param n - Octave number (4 = middle C, 5 = one octave up)
     */
    octave(n: number): this;
    /**
     * Shift up by n octaves.
     * @param n - Number of octaves (default 1)
     */
    octaveUp(n?: number): this;
    /**
     * Shift down by n octaves.
     * @param n - Number of octaves (default 1)
     */
    octaveDown(n?: number): this;
    scale(scaleName: string): this;
    /**
     * Set scale context for degree() resolution.
     * @param root - Root note (e.g., 'C', 'G', 'F#')
     * @param mode - Scale mode (major, minor, dorian, etc.)
     * @param octave - Base octave (default 4 = middle C octave)
     */
    setScale(root: string, mode: ScaleMode, octave?: number): this;
    /**
     * Get current scale context.
     */
    getScaleContext(): ScaleContext | null;
    /**
     * Set key signature context for automatic accidentals.
     * @param root - Key root (e.g., 'G', 'Bb')
     * @param mode - Key mode ('major' or 'minor')
     */
    key(root: string, mode: 'major' | 'minor'): this;
    /**
     * Get current key context.
     */
    getKeyContext(): KeyContext | null;
    /**
     * Set accidental override for the next note.
     * @param acc - Accidental to apply ('sharp', 'flat', or 'natural')
     */
    accidental(acc: Accidental): this;
    /**
     * Get and consume the next accidental override.
     * Returns null if no accidental is pending.
     */
    consumeAccidental(): Accidental | null;
    arpeggio(pattern: ArpPattern | null): this;
    /**
     * Set clip-level arpeggio rate (duration per arpeggiated note).
     * @param rate - Duration in beats (default: 0.125)
     */
    arpeggioRate(rate: number): this;
    /**
     * Set clip-level arpeggio gate (note duration multiplier).
     * @param gate - Gate value 0-1 (default: 0.8)
     */
    arpeggioGate(gate: number): this;
    /**
     * Get clip-level arpeggio pattern.
     */
    getArpeggioPattern(): ArpPattern | null;
    /**
     * Get clip-level arpeggio rate.
     */
    getArpeggioRate(): number;
    /**
     * Get clip-level arpeggio gate.
     */
    getArpeggioGate(): number;
    vibrato(rate: number, depth: number): this;
    /**
     * Disable vibrato for subsequent notes.
     */
    vibratoOff(): this;
    /**
     * Emit pitch bend LFO events for vibrato.
     * @param tick - Start tick
     * @param duration - Duration in ticks
     */
    protected emitVibratoLFO(tick: number, duration: number): void;
    /**
     * Set the default duration for notes that don't specify one.
     * @param duration - Duration in beats (e.g., 0.25 for quarter note, 0.5 for half)
     */
    defaultDuration(duration: number): this;
    /**
     * Get the default duration for notes.
     * @returns The default duration, or 1 (one beat) if not set
     */
    getDefaultDuration(): number;
    /**
     * Set default humanization settings for all notes in the clip.
     * Notes can override this with precise() to skip humanization.
     * @param settings - Humanization settings
     */
    defaultHumanize(settings: HumanizeSettings): this;
    /**
     * Get current humanization settings.
     */
    getHumanizeSettings(): HumanizeSettings | null;
    /**
     * Get the seeded RNG for deterministic randomization.
     * Used by cursors for random arpeggio patterns.
     */
    getSeededRng(): SeededRandom;
    /**
     * Set quantize settings for snap-to-grid timing correction.
     * Applied in flushNote() pipeline: Quantize → Groove → Humanize
     * @param grid - Grid size in beats (e.g., 0.25 = 16th notes)
     * @param options - Optional strength and duration settings
     */
    quantize(grid: number, options?: {
        strength?: number;
        duration?: boolean;
    }): this;
    /**
     * Get current quantize settings.
     */
    getQuantizeSettings(): QuantizeSettings | null;
    /**
     * Apply quantization to a tick value.
     * @param tick - Original tick value
     * @returns Quantized tick value
     */
    protected applyQuantize(tick: number): number;
    /**
     * Apply quantization to a duration value.
     * @param duration - Original duration value
     * @returns Quantized duration value
     */
    protected applyQuantizeDuration(duration: number): number;
    /**
     * Start a crescendo (gradual increase in velocity).
     * @param duration - Duration in ticks
     * @param options - Optional from/to velocities and curve type
     */
    crescendo(duration: number, options?: {
        from?: number;
        to?: number;
        curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
    }): this;
    /**
     * Start a decrescendo (gradual decrease in velocity).
     * @param duration - Duration in ticks
     * @param options - Optional from/to velocities and curve type
     */
    decrescendo(duration: number, options?: {
        from?: number;
        to?: number;
        curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out';
    }): this;
    /**
     * Ramp velocity to a target value over a duration.
     * @param to - Target velocity (0-1)
     * @param duration - Duration in ticks
     * @param options - Optional starting velocity
     */
    velocityRamp(to: number, duration: number, options?: {
        from?: number;
    }): this;
    /**
     * Apply a custom velocity curve defined by points.
     * @param points - Array of velocity points with tick offsets
     * @param duration - Total duration of the curve
     */
    velocityCurve(points: VelocityPoint[], duration: number): this;
    /**
     * Calculate velocity based on active dynamics at a given tick.
     * @param tick - Current tick position
     * @param baseVelocity - Base velocity to use if no dynamics active
     * @returns Calculated velocity (0-1)
     */
    protected calculateDynamicsVelocity(tick: number, baseVelocity: number): number;
    /**
     * Apply curve transformation to progress value.
     */
    protected applyCurve(progress: number, curve: 'linear' | 'exponential' | 'ease-in' | 'ease-out'): number;
    /**
     * Interpolate velocity from custom curve points.
     */
    protected interpolateCurveVelocity(elapsed: number, points: VelocityPoint[]): number;
    /**
     * Set the clip name for identification.
     */
    name(n: string): this;
    /**
     * Build and return the ClipNode AST structure.
     * Contains all operations recorded during clip construction.
     */
    build(): ClipNode;
    /**
     * Returns a snapshot of the current operations array.
     * Implements OperationsSource interface for use with loop() and play().
     * @returns Array of operations (shallow copy)
     */
    toOperations(): ClipOperation[];
    /**
     * Freeze the clip for efficient reuse.
     * Frozen clips can be played multiple times without re-expansion.
     * Creates a snapshot of current operations (not affected by future changes).
     * @param options - Freeze options (bpm, timeSignature)
     * @returns FrozenClip instance
     */
    freeze(options?: FreezeOptions): FrozenClip;
    /**
     * Execute a builder function with isolated state.
     * Changes to tempo, dynamics, or time signature inside the scope
     * do not affect the parent clip state.
     * @param options - Which state to isolate
     * @param builderFn - Builder function to execute in isolated scope
     * @returns this for chaining
     */
    isolate(options: ScopeIsolation, builderFn: (b: this) => this | void): this;
    /**
     * Flush a single note to kernel with all escape transformations applied.
     * @remarks This is the ONLY method that may call bridge.insertAsync()
     * @param pitch - MIDI pitch number
     * @param velocity - Normalized velocity (0-1)
     * @param duration - Note duration in beats
     * @param tick - Start tick
     * @param muted - Whether note is muted
     * @param sourceId - Source ID for topology tracking
     * @param expressionId - Optional expression ID
     * @param precise - If true, skip humanization for this note
     */
    flushNote(pitch: number, velocity: number, // Normalized 0-1
    duration: number, tick: number, muted: boolean, sourceId: number, expressionId?: number, precise?: boolean): void;
    /**
     * Apply swing timing transformation.
     * Derives ticksPerBeat from time signature.
     */
    protected applySwing(tick: number): number;
    /**
     * Apply velocity humanization using seeded PRNG.
     * Legacy micro-variation for backward compatibility.
     */
    protected applyHumanization(velocity: number): number;
    /**
     * Apply humanization settings to velocity and timing.
     * @param velocity - Input velocity (0-1)
     * @param tick - Input tick
     * @returns Object with humanized velocity and tick
     */
    protected applyHumanizeSettings(velocity: number, tick: number): {
        velocity: number;
        tick: number;
    };
    /**
     * Flush CC automation points to kernel.
     * @remarks Currently stubbed pending AudioWorklet CC handler verification.
     */
    protected flushCCAutomation(tick: number): void;
    /**
     * Print ASCII visualization of the clip to console.
     * @param bpm - Tempo for display (default: 120)
     * @returns this for chaining
     */
    preview(bpm?: number): this;
    /**
     * Convert MIDI note number to pitch name.
     * @internal
     */
    private midiToPitchName;
}
//# sourceMappingURL=SynapticClip.d.ts.map