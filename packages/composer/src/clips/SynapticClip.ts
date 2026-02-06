import { SiliconBridge, OPCODE } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { SynapticNode } from '@symphonyscript/synaptic';
import { ClipNode, NoteOperation, SCHEMA_VERSION, ScaleContext, ScaleMode, KeyContext, Accidental, DynamicsOp, VelocityPoint, HumanizeSettings, QuantizeSettings, CCOperation, AftertouchOperation, AutomationOperation, AutomationTarget, FreezeOptions, ScopeIsolation, ScopeOp, TempoKeyframe, TempoEnvelopeOp, ClipOperation, OperationsSource, ArpPattern, PitchBendOperation } from '../types';
import { parsePitch } from '../utils/pitch';
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
export abstract class SynapticClip extends SynapticNode {
    // Build output tracking
    protected clipName: string = '';
    protected operations: (NoteOperation | CCOperation | AftertouchOperation | AutomationOperation | ScopeOp | TempoEnvelopeOp | PitchBendOperation)[] = [];

    // Scale context for degree() resolution
    protected scaleContext: ScaleContext | null = null;

    // Key context for automatic accidentals (RFC-022)
    protected keyContext: KeyContext | null = null;
    protected nextAccidental: Accidental | null = null;

    // Escape state (persisted user intent)
    protected transposeOffset: number = 0;
    protected currentScale: string | null = null;
    protected _arpeggioPattern: ArpPattern | null = null;
    protected _arpeggioRate: number = 0.125;
    protected _arpeggioGate: number = 0.8;
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

    // MPE voice expression ID (Task 036)
    protected _expressionId: number | null = null;

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

    /**
     * Define a multi-keyframe tempo envelope.
     * Allows gradual tempo transitions over time with different curve types.
     * @param keyframes - Array of tempo keyframes (minimum 2 required)
     * @returns this for chaining
     * @throws Error if fewer than 2 keyframes provided
     */
    tempoEnvelope(keyframes: TempoKeyframe[]): this {
        if (keyframes.length < 2) {
            throw new Error('tempoEnvelope() requires at least 2 keyframes');
        }

        const op: TempoEnvelopeOp = {
            kind: 'tempoEnvelope',
            keyframes: keyframes.map(kf => ({ ...kf })), // Shallow copy
            tick: this.getCurrentTick()
        };

        this.operations.push(op);

        // Update current tempo to the final keyframe's BPM
        this.currentTempo = keyframes[keyframes.length - 1].bpm;

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

    /**
     * Send a MIDI Control Change message at the current tick.
     * @param controller - MIDI CC number (0-127)
     * @param value - CC value (0-127)
     * @throws Error if controller or value is out of range
     */
    control(controller: number, value: number): this {
        // Validate MIDI range
        if (controller < 0 || controller > 127) {
            throw new Error(`Controller number must be 0-127, got ${controller}`);
        }
        if (value < 0 || value > 127) {
            throw new Error(`CC value must be 0-127, got ${value}`);
        }

        // Queue CC operation at current tick
        const ccOp: CCOperation = {
            kind: 'cc',
            controller,
            value,
            tick: this.getCurrentTick()
        };
        this.operations.push(ccOp);

        // Also maintain current state in map (for potential real-time use)
        this.ccAutomation.set(controller, value);
        return this;
    }

    /**
     * Send a MIDI Aftertouch (pressure) message at the current tick.
     * @param value - Pressure value (0-1, normalized)
     * @param options - Optional type ('channel' or 'poly') and note for poly aftertouch
     * @throws Error if value is out of range or poly aftertouch missing note
     */
    aftertouch(value: number, options?: { type?: 'channel' | 'poly'; note?: string | number }): this {
        // Validate value range
        if (value < 0 || value > 1) {
            throw new Error(`Aftertouch value must be 0-1, got ${value}`);
        }

        const type = options?.type ?? 'channel';

        // Poly aftertouch requires a note
        if (type === 'poly' && options?.note === undefined) {
            throw new Error('Poly aftertouch requires a note parameter');
        }

        // Parse note if string
        let midiNote: number | undefined;
        if (options?.note !== undefined) {
            midiNote = typeof options.note === 'string' ? parsePitch(options.note) : options.note;
        }

        // Scale value to 0-127
        const scaledValue = Math.round(value * 127);

        // Queue aftertouch operation
        const atOp: AftertouchOperation = {
            kind: 'aftertouch',
            type,
            value: scaledValue,
            note: midiNote,
            tick: this.getCurrentTick()
        };
        this.operations.push(atOp);

        return this;
    }

    /**
     * Send a parameter automation message at the current tick.
     * @param target - Automation target parameter
     * @param value - Target value (volume: 0-1, pan: -1 to 1, others: 0-1)
     * @param rampBeats - Duration to ramp to value (instant if undefined)
     * @param curve - Ramp curve type (default: 'linear')
     * @throws Error if value is out of range for the target
     */
    automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: 'linear' | 'exponential' | 'smooth'): this {
        // Validate value range based on target
        if (target === 'pan') {
            if (value < -1 || value > 1) {
                throw new Error(`Pan value must be -1 to 1, got ${value}`);
            }
        } else {
            // All other targets use 0-1 range
            if (value < 0 || value > 1) {
                throw new Error(`${target} value must be 0-1, got ${value}`);
            }
        }

        // Queue automation operation
        const autoOp: AutomationOperation = {
            kind: 'automation',
            target,
            value,
            rampBeats,
            curve,
            tick: this.getCurrentTick()
        };
        this.operations.push(autoOp);

        return this;
    }

    /**
     * Shorthand for volume automation.
     * @param value - Volume level (0-1)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    volume(value: number, rampBeats?: number): this {
        return this.automate('volume', value, rampBeats);
    }

    /**
     * Shorthand for pan automation.
     * @param value - Pan position (-1 = left, 0 = center, 1 = right)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    pan(value: number, rampBeats?: number): this {
        return this.automate('pan', value, rampBeats);
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

    arpeggio(pattern: ArpPattern | null): this {
        this._arpeggioPattern = pattern;
        return this;
    }

    /**
     * Set clip-level arpeggio rate (duration per arpeggiated note).
     * @param rate - Duration in beats (default: 0.125)
     */
    arpeggioRate(rate: number): this {
        this._arpeggioRate = rate;
        return this;
    }

    /**
     * Set clip-level arpeggio gate (note duration multiplier).
     * @param gate - Gate value 0-1 (default: 0.8)
     */
    arpeggioGate(gate: number): this {
        this._arpeggioGate = gate;
        return this;
    }

    /**
     * Get clip-level arpeggio pattern.
     */
    getArpeggioPattern(): ArpPattern | null {
        return this._arpeggioPattern;
    }

    /**
     * Get clip-level arpeggio rate.
     */
    getArpeggioRate(): number {
        return this._arpeggioRate;
    }

    /**
     * Get clip-level arpeggio gate.
     */
    getArpeggioGate(): number {
        return this._arpeggioGate;
    }

    vibrato(rate: number, depth: number): this {
        this.vibratoRate = rate;
        this.vibratoDepth = depth;
        return this;
    }

    /**
     * Disable vibrato for subsequent notes.
     */
    vibratoOff(): this {
        this.vibratoRate = 0;
        this.vibratoDepth = 0;
        return this;
    }

    /**
     * Emit pitch bend LFO events for vibrato.
     * @param tick - Start tick
     * @param duration - Duration in ticks
     */
    protected emitVibratoLFO(tick: number, duration: number): void {
        // Return if vibrato is disabled
        if (this.vibratoRate <= 0 || this.vibratoDepth <= 0) return;

        // Sample interval: ~48 ticks (approx 1/40th of a beat at 1920 PPQ)
        // Correcting unit: duration is in beats. 48 ticks at 1920 PPQ is 0.025 beats.
        const interval = 0.025;

        // Calculate number of steps
        const steps = Math.floor(duration / interval);

        // Amplitude: 1 semitone = 4096 units (assuming +/- 2 semitone range = +/- 8192 units)
        const semitoneUnits = 4096;
        const amplitude = this.vibratoDepth * semitoneUnits;

        for (let i = 0; i <= steps; i++) {
            const currentTick = tick + i * interval;
            if (currentTick >= tick + duration) break;

            // Calculate LFO value (sine wave)
            // LFO Phase: currentTick * rate
            const val = Math.sin(currentTick * this.vibratoRate * Math.PI * 2);
            const bendValue = Math.floor(val * amplitude);

            // Clamp to legal range
            const clamped = Math.max(-8192, Math.min(8191, bendValue));

            const op: PitchBendOperation = {
                kind: 'pitchBend',
                value: clamped,
                tick: currentTick
            };
            this.operations.push(op);
        }

        // Reset at end
        this.operations.push({
            kind: 'pitchBend',
            value: 0,
            tick: tick + duration
        });
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

    /**
     * Get the seeded RNG for deterministic randomization.
     * Used by cursors for random arpeggio patterns.
     */
    getSeededRng(): SeededRandom {
        return this.humanizeRng;
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
            groove: this.currentGroove,
            loopRegion: this.loopEnabled ? {
                start: this.loopStart,
                end: this.loopEnd,
                enabled: true
            } : undefined
        };
    }

    /**
     * Returns a snapshot of the current operations array.
     * Implements OperationsSource interface for use with loop() and play().
     * @returns Array of operations (shallow copy)
     */
    toOperations(): ClipOperation[] {
        return [...this.operations];
    }

    /**
     * Freeze the clip for efficient reuse.
     * Frozen clips can be played multiple times without re-expansion.
     * Creates a snapshot of current operations (not affected by future changes).
     * @param options - Freeze options (bpm, timeSignature)
     * @returns FrozenClip instance
     */
    freeze(options?: FreezeOptions): FrozenClip {
        // Create a deep copy of operations to snapshot current state
        const snapshotOps = this.operations.map(op => ({ ...op }));
        const clipNode: ClipNode = {
            _version: SCHEMA_VERSION,
            kind: 'clip',
            name: this.clipName,
            operations: snapshotOps,
            tempo: this.currentTempo,
            timeSignature: [this.timeSignatureNumerator, this.timeSignatureDenominator],
            swing: this.swingAmount,
            groove: this.currentGroove
        };
        const freezeOpts: FreezeOptions = {
            bpm: options?.bpm ?? this.currentTempo,
            timeSignature: options?.timeSignature ?? [this.timeSignatureNumerator, this.timeSignatureDenominator]
        };
        return new FrozenClip(clipNode, freezeOpts);
    }

    /**
     * Execute a builder function with isolated state.
     * Changes to tempo, dynamics, or time signature inside the scope
     * do not affect the parent clip state.
     * @param options - Which state to isolate
     * @param builderFn - Builder function to execute in isolated scope
     * @returns this for chaining
     */
    isolate(options: ScopeIsolation, builderFn: (b: this) => this | void): this {
        // Save current state
        const savedTempo = this.currentTempo;
        const savedDynamics = this.dynamicsPoints ? [...this.dynamicsPoints] : null;
        const savedTimeSignatureNum = this.timeSignatureNumerator;
        const savedTimeSignatureDen = this.timeSignatureDenominator;

        // Track operations added during scope
        const startOpCount = this.operations.length;

        // Execute builder function
        const result = builderFn(this as this);

        // If result is a cursor-like object with commit, commit it
        if (result && result !== this && 'commit' in result) {
            (result as any).commit();
        }

        // Collect operations added during scope
        const scopeOps = this.operations.slice(startOpCount);

        // Remove scope operations from main array
        this.operations.length = startOpCount;

        // Create scope operation if there are any operations
        if (scopeOps.length > 0) {
            const scopeOp: ScopeOp = {
                kind: 'scope',
                isolate: options,
                operations: scopeOps.filter(op =>
                    op.kind === 'note' || op.kind === 'cc' || op.kind === 'aftertouch' || op.kind === 'automation'
                ) as (NoteOperation | CCOperation | AftertouchOperation | AutomationOperation)[]
            };
            this.operations.push(scopeOp);
        }

        // Restore isolated state
        if (options.tempo) {
            this.currentTempo = savedTempo;
        }
        if (options.dynamics && savedDynamics) {
            this.dynamicsPoints = savedDynamics;
        }
        if (options.timeSignature) {
            this.timeSignatureNumerator = savedTimeSignatureNum;
            this.timeSignatureDenominator = savedTimeSignatureDen;
        }

        return this;
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

        // Apply Vibrato LFO (Task 052)
        if (this.vibratoRate > 0 && this.vibratoDepth > 0) {
            this.emitVibratoLFO(humanizedTick, quantizedDuration); // Use humanized tick/duration? 
            // Directive says: emitVibratoLFO(tick, duration). 
            // Usually pitch bend should align with the note.
            // Using tick/duration passed to flushNote or the calculated ones?
            // "Integrate in flushNote": 
            //    if (this.vibratoRate > 0 ...) this.emitVibratoLFO(tick, duration);
            // I'll use the final timestamps (humanizedTick, quantizedDuration) to match the note's actual position in the stream.
        }

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
        // Include expressionId from parameter (if non-zero) or clip-level setting
        // expressionId=0 from cursor means "use clip default"
        const finalExpressionId = (expressionId && expressionId !== 0) ? expressionId : (this._expressionId ?? undefined);
        this.operations.push({
            kind: 'note',
            pitch: finalPitch,
            velocity: finalVel,
            duration: quantizedDuration,
            tick: humanizedTick,
            muted,
            sourceId,
            expressionId: finalExpressionId
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

    /**
     * Print ASCII visualization of the clip to console.
     * @param bpm - Tempo for display (default: 120)
     * @returns this for chaining
     */
    preview(bpm: number = 120): this {
        const clip = this.build();
        const noteOps = clip.operations.filter(op => op.kind === 'note') as NoteOperation[];

        if (noteOps.length === 0) {
            console.log(`Clip: ${clip.name} (${bpm} BPM)`);
            console.log('(empty)');
            return this;
        }

        // Find time range
        const maxTick = noteOps.reduce((max, op) => Math.max(max, op.tick + op.duration), 0);
        const totalBars = Math.ceil(maxTick / 4); // 4 beats per bar
        const barsToShow = Math.max(totalBars, 1);

        // Grid resolution: 16th notes (4 per beat, 16 per bar)
        const stepsPerBar = 16;
        const totalSteps = barsToShow * stepsPerBar;
        const stepDuration = 0.25; // 1/16th note in beats

        // Collect unique pitches, sorted high to low
        const pitches = [...new Set(noteOps.map(op => op.pitch))].sort((a, b) => b - a);

        // Build grid for each pitch
        const grid: Map<number, string[]> = new Map();
        for (const pitch of pitches) {
            grid.set(pitch, new Array(totalSteps).fill('.'));
        }

        // Fill in notes
        for (const op of noteOps) {
            const pitchGrid = grid.get(op.pitch);
            if (!pitchGrid) continue;

            const startStep = Math.floor(op.tick / stepDuration);
            const durationSteps = Math.ceil(op.duration / stepDuration);

            // Mark onset
            if (startStep >= 0 && startStep < totalSteps) {
                pitchGrid[startStep] = 'X';
            }

            // Mark sustain (optional, use '-' for sustained notes)
            for (let i = 1; i < durationSteps && startStep + i < totalSteps; i++) {
                if (pitchGrid[startStep + i] === '.') {
                    pitchGrid[startStep + i] = '-';
                }
            }
        }

        // Render output
        console.log(`Clip: ${clip.name} (${bpm} BPM)`);

        // Beat header
        let beatHeader = 'Beat: ';
        for (let bar = 0; bar < barsToShow; bar++) {
            beatHeader += '|1---2---3---4---|';
        }
        console.log(beatHeader);

        // Pitch rows
        for (const pitch of pitches) {
            const pitchGrid = grid.get(pitch)!;
            const pitchName = this.midiToPitchName(pitch);
            const paddedName = pitchName.padEnd(5);

            let row = `${paddedName} `;
            for (let bar = 0; bar < barsToShow; bar++) {
                const barStart = bar * stepsPerBar;
                const barSlice = pitchGrid.slice(barStart, barStart + stepsPerBar).join('');
                row += `|${barSlice}|`;
            }
            console.log(row);
        }

        return this;
    }

    /**
     * Convert MIDI note number to pitch name.
     * @internal
     */
    private midiToPitchName(midi: number): string {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = noteNames[midi % 12];
        return `${note}${octave}`;
    }
}
