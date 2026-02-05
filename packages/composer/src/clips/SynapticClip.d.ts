import { SiliconBridge } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { SynapticNode } from '@symphonyscript/synaptic';
import { ClipNode, NoteOperation, ScaleContext, ScaleMode, KeyContext, Accidental, DynamicsOp, VelocityPoint } from '../types';
export declare abstract class SynapticClip extends SynapticNode {
    protected clipName: string;
    protected operations: NoteOperation[];
    protected scaleContext: ScaleContext | null;
    protected keyContext: KeyContext | null;
    protected nextAccidental: Accidental | null;
    protected transposeOffset: number;
    protected currentScale: string | null;
    protected arpeggioPattern: string | null;
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
    constructor(bridge: SiliconBridge, seed?: number);
    abstract getCurrentTick(): number;
    abstract advanceTick(ticks: number): void;
    abstract generateSourceId(): number;
    rest(duration?: number): this;
    tempo(bpm: number): this;
    timeSignature(numerator: number, denominator: number): this;
    swing(val: number): this;
    groove(name: string): this;
    control(cc: number, val: number): this;
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
    arpeggio(pattern: string): this;
    vibrato(rate: number, depth: number): this;
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
     * Flush a single note to kernel with all escape transformations applied.
     * @remarks This is the ONLY method that may call bridge.insertAsync()
     */
    flushNote(pitch: number, velocity: number, // Normalized 0-1
    duration: number, tick: number, muted: boolean, sourceId: number, expressionId?: number): void;
    /**
     * Apply swing timing transformation.
     * Derives ticksPerBeat from time signature.
     */
    protected applySwing(tick: number): number;
    /**
     * Apply velocity humanization using seeded PRNG.
     */
    protected applyHumanization(velocity: number): number;
    /**
     * Flush CC automation points to kernel.
     * @remarks Currently stubbed pending AudioWorklet CC handler verification.
     */
    protected flushCCAutomation(tick: number): void;
}
//# sourceMappingURL=SynapticClip.d.ts.map