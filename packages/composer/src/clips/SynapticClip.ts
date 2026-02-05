import { SiliconBridge, OPCODE } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { SynapticNode } from '@symphonyscript/synaptic';
import { ClipNode, NoteOperation, SCHEMA_VERSION, ScaleContext, ScaleMode, KeyContext, Accidental, DynamicsOp, VelocityPoint, HumanizeSettings, QuantizeSettings } from '../types';

export abstract class SynapticClip extends SynapticNode {
    // Build output tracking
    protected clipName: string = '';
    protected operations: NoteOperation[] = [];

    // Scale context for degree() resolution
    protected scaleContext: ScaleContext | null = null;

    // Key context for automatic accidentals (RFC-022)
    protected keyContext: KeyContext | null = null;
    protected nextAccidental: Accidental | null = null;

    // Escape state (persisted user intent)
    protected transposeOffset: number = 0;
    protected currentScale: string | null = null;
    protected arpeggioPattern: string | null = null;
    protected vibratoRate: number = 0;
    protected vibratoDepth: number = 0;
    protected currentTempo: number = 120; // Default BPM
    protected timeSignatureNumerator: number = 4;
    protected timeSignatureDenominator: number = 4;
    protected swingAmount: number = 0.5;
    protected currentGroove: string | null = null;
    protected ccAutomation: Map<number, number>;
    protected stackingEnabled: boolean = false;
    protected loopEnabled: boolean = false;
    protected loopStart: number = 0;
    protected loopEnd: number = 0;

    // RFC-050: Seeded RNG for deterministic humanization
    protected humanizeRng: SeededRandom;

    // Dynamics state (Task 024)
    protected activeDynamics: DynamicsOp | null = null;
    protected dynamicsStartTick: number = 0;
    protected velocityCurvePoints: VelocityPoint[] | null = null;

    // Default duration state (Task 030)
    protected _defaultDuration: number | null = null;

    // Humanization settings (Task 031)
    protected _humanizeSettings: HumanizeSettings | null = null;

    // Quantize settings (Task 032)
    protected _quantizeSettings: QuantizeSettings | null = null;

    constructor(bridge: SiliconBridge, seed: number = 0) {
        super(bridge);
        this.ccAutomation = new Map();
        this.humanizeRng = new SeededRandom(seed);
    }

    // Abstract methods that the real implementation will provide
    abstract getCurrentTick(): number;
    abstract advanceTick(ticks: number): void;
    abstract generateSourceId(): number;

    // Escape implementations (store state)
    rest(duration?: number): this {
        if (duration) this.advanceTick(duration);
        return this;
    }

    tempo(bpm: number): this {
        this.currentTempo = bpm;
        return this;
    }

    timeSignature(numerator: number, denominator: number): this {
        this.timeSignatureNumerator = numerator;
        this.timeSignatureDenominator = denominator;
        return this;
    }

    swing(val: number): this {
        this.swingAmount = val;
        return this;
    }

    groove(name: string): this {
        // Store groove template name for future application
        // (Groove templates would be resolved from a GrooveLibrary)
        this.currentGroove = name;
        return this;
    }

    control(cc: number, val: number): this {
        this.ccAutomation.set(cc, val);
        return this;
    }

    stack(): this {
        // Enable polyphonic stacking mode (multiple notes at same tick)
        this.stackingEnabled = true;
        return this;
    }

    setLoopRegion(start: number, end: number): this {
        // Store loop region boundaries
        this.loopStart = start;
        this.loopEnd = end;
        this.loopEnabled = true;

        // [RFC-054] Sync OS-layer cycle property.
        // setCycle() instantly creates BARRIER node and closes loop topology.
        // No finalize() call is needed - topology is valid immediately.
        this.setCycle(end - start);
        return this;
    }

    // [RFC-054] finalize() REMOVED - Loop topology is now instantly closed by
    // setCycle() via the BARRIER mechanism. The Kernel handles phase alignment
    // at runtime, eliminating the need for manual finalization.

    // Melodic escape methods (fluent)
    transpose(semitones: number): this {
        this.transposeOffset = semitones;
        return this;
    }

    /**
     * Set absolute octave context.
     * @param n - Octave number (4 = middle C, 5 = one octave up)
     */
    octave(n: number): this {
        this.transposeOffset = (n - 4) * 12;
        return this;
    }

    /**
     * Shift up by n octaves.
     * @param n - Number of octaves (default 1)
     */
    octaveUp(n: number = 1): this {
        this.transposeOffset += n * 12;
        return this;
    }

    /**
     * Shift down by n octaves.
     * @param n - Number of octaves (default 1)
     */
    octaveDown(n: number = 1): this {
        this.transposeOffset -= n * 12;
        return this;
    }

    scale(scaleName: string): this {
        this.currentScale = scaleName;
        return this;
    }

    /**
     * Set scale context for degree() resolution.
     * @param root - Root note (e.g., 'C', 'G', 'F#')
     * @param mode - Scale mode (major, minor, dorian, etc.)
     * @param octave - Base octave (default 4 = middle C octave)
     */
    setScale(root: string, mode: ScaleMode, octave: number = 4): this {
        this.scaleContext = { root, mode, octave };
        return this;
    }

    /**
     * Get current scale context.
     */
    getScaleContext(): ScaleContext | null {
        return this.scaleContext;
    }

    /**
     * Set key signature context for automatic accidentals.
     * @param root - Key root (e.g., 'G', 'Bb')
     * @param mode - Key mode ('major' or 'minor')
     */
    key(root: string, mode: 'major' | 'minor'): this {
        this.keyContext = { root, mode };
        return this;
    }

    /**
     * Get current key context.
     */
    getKeyContext(): KeyContext | null {
        return this.keyContext;
    }

    /**
     * Set accidental override for the next note.
     * @param acc - Accidental to apply ('sharp', 'flat', or 'natural')
     */
    accidental(acc: Accidental): this {
        this.nextAccidental = acc;
        return this;
    }

    /**
     * Get and consume the next accidental override.
     * Returns null if no accidental is pending.
     */
    consumeAccidental(): Accidental | null {
        const acc = this.nextAccidental;
        this.nextAccidental = null;
        return acc;
    }

    arpeggio(pattern: string): this {
        this.arpeggioPattern = pattern;
        return this;
    }

    vibrato(rate: number, depth: number): this {
        this.vibratoRate = rate;
        this.vibratoDepth = depth;
        return this;
    }

    // =========================================================================
    // Default Duration Methods (Task 030)
    // =========================================================================

    /**
     * Set the default duration for notes that don't specify one.
     * @param duration - Duration in beats (e.g., 0.25 for quarter note, 0.5 for half)
     */
    defaultDuration(duration: number): this {
        this._defaultDuration = duration;
        return this;
    }

    /**
     * Get the default duration for notes.
     * @returns The default duration, or 1 (one beat) if not set
     */
    getDefaultDuration(): number {
        return this._defaultDuration ?? 1;
    }

    // =========================================================================
    // Humanization Methods (Task 031)
    // =========================================================================

    /**
     * Set default humanization settings for all notes in the clip.
     * Notes can override this with precise() to skip humanization.
     * @param settings - Humanization settings
     */
    defaultHumanize(settings: HumanizeSettings): this {
        this._humanizeSettings = settings;
        // Reinitialize RNG with new seed if provided
        if (settings.seed !== undefined) {
            this.humanizeRng = new SeededRandom(settings.seed);
        }
        return this;
    }

    /**
     * Get current humanization settings.
     */
    getHumanizeSettings(): HumanizeSettings | null {
        return this._humanizeSettings;
    }

    // =========================================================================
    // Quantize Methods (Task 032)
    // =========================================================================

    /**
     * Set quantize settings for snap-to-grid timing correction.
     * Applied in flushNote() pipeline: Quantize → Groove → Humanize
     * @param grid - Grid size in beats (e.g., 0.25 = 16th notes)
     * @param options - Optional strength and duration settings
     */
    quantize(grid: number, options?: { strength?: number; duration?: boolean }): this {
        this._quantizeSettings = {
            grid,
            strength: options?.strength,
            duration: options?.duration
        };
        return this;
    }

    /**
     * Get current quantize settings.
     */
    getQuantizeSettings(): QuantizeSettings | null {
        return this._quantizeSettings;
    }

    /**
     * Apply quantization to a tick value.
     * @param tick - Original tick value
     * @returns Quantized tick value
     */
    protected applyQuantize(tick: number): number {
        if (!this._quantizeSettings) return tick;

        const { grid, strength = 1 } = this._quantizeSettings;

        // Snap to nearest grid point
        const snappedTick = Math.round(tick / grid) * grid;

        // Interpolate based on strength
        return tick + (snappedTick - tick) * strength;
    }

    /**
     * Apply quantization to a duration value.
     * @param duration - Original duration value
     * @returns Quantized duration value
     */
    protected applyQuantizeDuration(duration: number): number {
        if (!this._quantizeSettings || !this._quantizeSettings.duration) return duration;

        const { grid, strength = 1 } = this._quantizeSettings;

        // Snap to nearest grid point (minimum 1 grid unit)
        const snappedDuration = Math.max(grid, Math.round(duration / grid) * grid);

        // Interpolate based on strength
        return duration + (snappedDuration - duration) * strength;
    }

    // =========================================================================
    // Dynamics Methods (Task 024)
    // =========================================================================

    /**
     * Start a crescendo (gradual increase in velocity).
     * @param duration - Duration in ticks
     * @param options - Optional from/to velocities and curve type
     */
    crescendo(duration: number, options?: { from?: number; to?: number; curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out' }): this {
        const from = options?.from ?? 0.4;
        const to = options?.to ?? 1.0;
        const curve = options?.curve ?? 'linear';

        this.activeDynamics = {
            kind: 'dynamics',
            type: 'crescendo',
            from,
            to,
            duration,
            curve
        };
        this.dynamicsStartTick = this.getCurrentTick();
        this.velocityCurvePoints = null;
        return this;
    }

    /**
     * Start a decrescendo (gradual decrease in velocity).
     * @param duration - Duration in ticks
     * @param options - Optional from/to velocities and curve type
     */
    decrescendo(duration: number, options?: { from?: number; to?: number; curve?: 'linear' | 'exponential' | 'ease-in' | 'ease-out' }): this {
        const from = options?.from ?? 1.0;
        const to = options?.to ?? 0.4;
        const curve = options?.curve ?? 'linear';

        this.activeDynamics = {
            kind: 'dynamics',
            type: 'decrescendo',
            from,
            to,
            duration,
            curve
        };
        this.dynamicsStartTick = this.getCurrentTick();
        this.velocityCurvePoints = null;
        return this;
    }

    /**
     * Ramp velocity to a target value over a duration.
     * @param to - Target velocity (0-1)
     * @param duration - Duration in ticks
     * @param options - Optional starting velocity
     */
    velocityRamp(to: number, duration: number, options?: { from?: number }): this {
        const from = options?.from ?? 0.8;

        this.activeDynamics = {
            kind: 'dynamics',
            type: 'ramp',
            from,
            to,
            duration,
            curve: 'linear'
        };
        this.dynamicsStartTick = this.getCurrentTick();
        this.velocityCurvePoints = null;
        return this;
    }

    /**
     * Apply a custom velocity curve defined by points.
     * @param points - Array of velocity points with tick offsets
     * @param duration - Total duration of the curve
     */
    velocityCurve(points: VelocityPoint[], duration: number): this {
        if (points.length < 2) {
            throw new Error('velocityCurve requires at least 2 points');
        }

        // Sort points by tick offset
        const sortedPoints = [...points].sort((a, b) => a.tick - b.tick);

        this.activeDynamics = {
            kind: 'dynamics',
            type: 'curve',
            from: sortedPoints[0].velocity,
            to: sortedPoints[sortedPoints.length - 1].velocity,
            duration
        };
        this.dynamicsStartTick = this.getCurrentTick();
        this.velocityCurvePoints = sortedPoints;
        return this;
    }

    /**
     * Calculate velocity based on active dynamics at a given tick.
     * @param tick - Current tick position
     * @param baseVelocity - Base velocity to use if no dynamics active
     * @returns Calculated velocity (0-1)
     */
    protected calculateDynamicsVelocity(tick: number, baseVelocity: number): number {
        if (!this.activeDynamics) {
            return baseVelocity;
        }

        const elapsed = tick - this.dynamicsStartTick;
        const { from, to, duration, curve } = this.activeDynamics;

        // Check if dynamics have expired
        if (elapsed >= duration) {
            this.activeDynamics = null;
            this.velocityCurvePoints = null;
            return baseVelocity;
        }

        // Handle custom curve
        if (this.activeDynamics.type === 'curve' && this.velocityCurvePoints) {
            return this.interpolateCurveVelocity(elapsed, this.velocityCurvePoints);
        }

        // Calculate progress (0-1)
        const progress = elapsed / duration;

        // Apply curve transformation
        const easedProgress = this.applyCurve(progress, curve ?? 'linear');

        // Linear interpolation between from and to
        return from + (to - from) * easedProgress;
    }

    /**
     * Apply curve transformation to progress value.
     */
    protected applyCurve(progress: number, curve: 'linear' | 'exponential' | 'ease-in' | 'ease-out'): number {
        switch (curve) {
            case 'linear':
                return progress;
            case 'exponential':
                return progress * progress;
            case 'ease-in':
                return progress * progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 3);
            default:
                return progress;
        }
    }

    /**
     * Interpolate velocity from custom curve points.
     */
    protected interpolateCurveVelocity(elapsed: number, points: VelocityPoint[]): number {
        // Find surrounding points
        let lower = points[0];
        let upper = points[points.length - 1];

        for (let i = 0; i < points.length - 1; i++) {
            if (elapsed >= points[i].tick && elapsed < points[i + 1].tick) {
                lower = points[i];
                upper = points[i + 1];
                break;
            }
        }

        // Handle edge cases
        if (elapsed <= lower.tick) return lower.velocity;
        if (elapsed >= upper.tick) return upper.velocity;

        // Linear interpolation between surrounding points
        const segmentProgress = (elapsed - lower.tick) / (upper.tick - lower.tick);
        return lower.velocity + (upper.velocity - lower.velocity) * segmentProgress;
    }

    /**
     * Set the clip name for identification.
     */
    name(n: string): this {
        this.clipName = n;
        return this;
    }

    /**
     * Build and return the ClipNode AST structure.
     * Contains all operations recorded during clip construction.
     */
    build(): ClipNode {
        return {
            _version: SCHEMA_VERSION,
            kind: 'clip',
            name: this.clipName,
            operations: this.operations,
            tempo: this.currentTempo,
            timeSignature: [this.timeSignatureNumerator, this.timeSignatureDenominator],
            swing: this.swingAmount,
            groove: this.currentGroove
        };
    }

    // =========================================================================
    // RFC-050: Clip-Mediated Flush Architecture
    // =========================================================================

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
    flushNote(
        pitch: number,
        velocity: number,      // Normalized 0-1
        duration: number,
        tick: number,
        muted: boolean,
        sourceId: number,
        expressionId?: number,
        precise: boolean = false
    ): void {
        // 1. Apply transpose
        const finalPitch = pitch + this.transposeOffset;

        // 2. Apply dynamics (before humanization for clean curve)
        const dynamicsVel = this.calculateDynamicsVelocity(tick, velocity);

        // Pipeline order: Quantize → Groove → Humanize

        // 3. Apply quantization (snap to grid) - Task 032
        let quantizedTick = this.applyQuantize(tick);
        let quantizedDuration = this.applyQuantizeDuration(duration);

        // 4. Apply swing/groove timing
        const swungTick = this.applySwing(quantizedTick);

        // 5. Apply humanization (velocity + timing) unless precise flag is set
        let humanizedVel = dynamicsVel;
        let humanizedTick = swungTick;
        if (!precise && this._humanizeSettings) {
            const result = this.applyHumanizeSettings(dynamicsVel, swungTick);
            humanizedVel = result.velocity;
            humanizedTick = result.tick;
        } else if (!precise) {
            // Legacy micro-variation for backward compatibility
            humanizedVel = this.applyHumanization(dynamicsVel);
        }

        // 6. Insert CC automation if pending (stubbed)
        // this.flushCCAutomation(humanizedTick);

        // 7. Final kernel insertion
        const finalVel = Math.floor(humanizedVel * 127);
        const ptr = this.bridge.insertAsync(
            OPCODE.NOTE,
            finalPitch,
            finalVel,
            quantizedDuration,
            humanizedTick,
            muted,
            sourceId,
            this.exitId, // Chain to previous node (if any)
            expressionId
        );

        // 8. Track operation for build() output
        this.operations.push({
            kind: 'note',
            pitch: finalPitch,
            velocity: finalVel,
            duration: quantizedDuration,
            tick: humanizedTick,
            muted,
            sourceId
        });

        // 7. Update Topology (Generic SynapticNode support)
        if (ptr >= 0) {
            if (this.entryId === undefined) {
                this.entryId = sourceId;
            }
            this.exitId = sourceId;
        }
    }

    /**
     * Apply swing timing transformation.
     * Derives ticksPerBeat from time signature.
     */
    protected applySwing(tick: number): number {
        // Derive from time signature (4/4 → 1.0 beat, 3/4 → 0.75 beat)
        const ticksPerBeat = 4.0 / this.timeSignatureDenominator;
        const beatPhase = tick % ticksPerBeat;

        if (beatPhase > ticksPerBeat / 2) {
            // Off-beat: delay by swing amount
            return tick + (this.swingAmount - 0.5) * 0.1;
        }
        return tick;
    }

    /**
     * Apply velocity humanization using seeded PRNG.
     * Legacy micro-variation for backward compatibility.
     */
    protected applyHumanization(velocity: number): number {
        const variation = (this.humanizeRng.next() - 0.5) * 0.05; // ±2.5%
        return Math.max(0, Math.min(1, velocity + variation));
    }

    /**
     * Apply humanization settings to velocity and timing.
     * @param velocity - Input velocity (0-1)
     * @param tick - Input tick
     * @returns Object with humanized velocity and tick
     */
    protected applyHumanizeSettings(velocity: number, tick: number): { velocity: number; tick: number } {
        const settings = this._humanizeSettings!;

        // Apply velocity variation
        let humanizedVel = velocity;
        if (settings.velocity && settings.velocity > 0) {
            const velVariation = (this.humanizeRng.next() - 0.5) * 2 * settings.velocity;
            humanizedVel = Math.max(0, Math.min(1, velocity + velVariation));
        }

        // Apply timing variation (ms → beats conversion)
        // Assumes 120 BPM as reference: 1 beat = 500ms, so 1ms = 0.002 beats
        let humanizedTick = tick;
        if (settings.timing && settings.timing > 0) {
            // Convert ms to beats using current tempo
            const msPerBeat = 60000 / this.currentTempo;
            const maxOffsetBeats = settings.timing / msPerBeat;
            const timingVariation = (this.humanizeRng.next() - 0.5) * 2 * maxOffsetBeats;
            humanizedTick = tick + timingVariation;
        }

        return { velocity: humanizedVel, tick: humanizedTick };
    }

    /**
     * Flush CC automation points to kernel.
     * @remarks Currently stubbed pending AudioWorklet CC handler verification.
     */
    protected flushCCAutomation(tick: number): void {
        if (this.ccAutomation.size === 0) return;

        // TEMPORARY STUB: Verify AudioWorklet CC handler before enabling
        // for (const [cc, value] of this.ccAutomation) {
        //     this.bridge.insertAsync(
        //         OPCODE.CC,
        //         cc,
        //         value,
        //         0,
        //         tick,
        //         false,
        //         this.generateSourceId(),
        //         undefined,
        //         undefined
        //     );
        // }
        // this.ccAutomation.clear();
    }
}
