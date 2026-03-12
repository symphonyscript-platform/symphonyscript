import { SiliconBridge, OPCODE } from '@symphonyscript/kernel';
import { SeededRandom } from '@symphonyscript/core';
import { SynapticNode } from '@symphonyscript/synaptic';
import { ClipNode, SCHEMA_VERSION, ScaleContext, ScaleMode, KeyContext, Accidental, DynamicsType, CurveType, VelocityPoint, HumanizeSettings, QuantizeSettings, AutomationTarget, FreezeOptions, TempoKeyframe, ArpPattern, PITCH_CLASS_TO_ROOT } from '../types';
import { parsePitch } from '../utils/pitch';
import { FrozenClip } from './FrozenClip';

const sortVelocityPoints = (a: VelocityPoint, b: VelocityPoint) => a.tick - b.tick;
const AUTOMATION_TARGET_NAMES: readonly string[] = ['volume', 'pan', 'filter', 'resonance', 'attack', 'release'];

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
 * 
 * Task 058: Kernel is the single source of truth. No operations[] buffering
 * and no operations reconstruction from kernel traversal at runtime.
 */
export abstract class SynapticClip extends SynapticNode {
    protected clipName: string = '';

    // Scale context for degree() resolution (flattened primitives)
    protected _scaleRoot: number = -1;   // -1 = no scale, 0-11 = pitch class
    protected _scaleMode: ScaleMode = ScaleMode.NONE;
    protected _scaleOctave: number = 4;

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
    protected stackingEnabled: boolean = false;
    protected loopEnabled: boolean = false;
    protected loopStart: number = 0;
    protected loopEnd: number = 0;

    // RFC-050: Seeded RNG for deterministic humanization
    protected humanizeRng: SeededRandom;

    // Dynamics state (Task 024, flattened)
    protected _dynType: DynamicsType = DynamicsType.NONE;
    protected _dynStart: number = 0;
    protected _dynDuration: number = 0;
    protected _dynFrom: number = 0;
    protected _dynTo: number = 0;
    protected _dynCurve: CurveType = CurveType.LINEAR;
    protected velocityCurvePoints: VelocityPoint[] | null = null;

    // Default duration state (Task 030)
    protected _defaultDuration: number | null = null;

    // Humanization settings (Task 031, flattened)
    protected _humVel: number = 0;
    protected _humTiming: number = 0;
    protected _humEnabled: boolean = false;
    protected _humSeed: number = -1;    // -1 = not set
    protected _humanizeVelOut: number = 0;
    protected _humanizeTickOut: number = 0;

    // Quantize settings (Task 032)
    protected _quantizeSettings: QuantizeSettings | null = null;

    // MPE voice expression ID (Task 036)
    protected _expressionId: number | null = null;

    // Task 063: Pre-allocated primitive state stack for pushState/popState.
    private static readonly MAX_STACK_DEPTH = 16;
    private static readonly STACK_FRAME_SIZE = 9; // tempo + dynamics(6) + time-signature(2)
    private readonly _stateStackNum: Float64Array;
    private readonly _stateStackCurve: Array<VelocityPoint[] | null>;
    private _stackPtr: number = 0;

    constructor(bridge: SiliconBridge, seed: number = 0) {
        super(bridge);
        this.humanizeRng = new SeededRandom(seed);
        this._stateStackNum = new Float64Array(SynapticClip.MAX_STACK_DEPTH * SynapticClip.STACK_FRAME_SIZE);
        this._stateStackCurve = new Array<VelocityPoint[] | null>(SynapticClip.MAX_STACK_DEPTH).fill(null);
    }

    // Abstract methods that the real implementation will provide
    abstract getCurrentTick(): number;
    abstract advanceTick(ticks: number): this;
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

        // Update current tempo to the final keyframe's BPM (Task 058: no operations push)
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

        // Task 062: Direct-to-Kernel flush (pitch=controller, velocity=value for OPCODE.CC)
        this.bridge.insertAsync(
            OPCODE.CC,
            controller,
            value,
            0,
            this.getCurrentTick(),
            false,
            this.generateSourceId()
        );
        return this;
    }

    /**
     * Send a MIDI Aftertouch (pressure) message at the current tick.
     * No options objects - use note param for poly aftertouch.
     * @param value - Pressure value (0-1, normalized)
     * @param note - Note for poly aftertouch (omit for channel aftertouch)
     */
    aftertouch(value: number, note?: string | number): this {
        if (value < 0 || value > 1) {
            throw new Error(`Aftertouch value must be 0-1, got ${value}`);
        }
        if (note !== undefined) {
            typeof note === 'string' ? parsePitch(note) : note;
        }
        return this;
    }

    /**
     * Send a parameter automation message at the current tick.
     * @param target - Automation target parameter
     * @param value - Target value (volume: 0-1, pan: -1 to 1, others: 0-1)
     * @param rampBeats - Duration to ramp to value (instant if undefined)
     * @param curve - Ramp curve type (default: CurveType.LINEAR)
     * @throws Error if value is out of range for the target
     */
    automate(target: AutomationTarget, value: number, rampBeats?: number, curve?: CurveType): this {
        if (target === AutomationTarget.PAN) {
            if (value < -1 || value > 1) {
                throw new Error(`Pan value must be -1 to 1, got ${value}`);
            }
        } else {
            if (value < 0 || value > 1) {
                throw new Error(`${AUTOMATION_TARGET_NAMES[target]} value must be 0-1, got ${value}`);
            }
        }

        // Task 058: No operations push
        return this;
    }

    /**
     * Shorthand for volume automation.
     * @param value - Volume level (0-1)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    volume(value: number, rampBeats?: number): this {
        return this.automate(AutomationTarget.VOLUME, value, rampBeats);
    }

    /**
     * Shorthand for pan automation.
     * @param value - Pan position (-1 = left, 0 = center, 1 = right)
     * @param rampBeats - Duration to ramp (instant if undefined)
     */
    pan(value: number, rampBeats?: number): this {
        return this.automate(AutomationTarget.PAN, value, rampBeats);
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
        this._scaleRoot = parsePitch(root + '4') % 12;
        this._scaleMode = mode;
        this._scaleOctave = octave;
        return this;
    }

    /**
     * Get current scale context.
     */
    getScaleContext(): ScaleContext | null {
        if (this._scaleRoot < 0) return null;
        return {
            root: PITCH_CLASS_TO_ROOT[this._scaleRoot],
            mode: this._scaleMode,
            octave: this._scaleOctave
        };
    }

    /**
     * Set key signature context for automatic accidentals.
     * @param root - Key root (e.g., 'G', 'Bb')
     * @param mode - Key mode (ScaleMode.MAJOR or ScaleMode.MINOR)
     */
    key(root: string, mode: ScaleMode): this {
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
     * @param acc - Accidental to apply (Accidental.SHARP, Accidental.FLAT, or Accidental.NATURAL)
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
    protected emitVibratoLFO(_tick: number, _duration: number): void {
        // Task 058: Pitch bend not yet supported by Kernel insertAsync; no-op.
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
        this._humVel = settings.velocity ?? 0;
        this._humTiming = settings.timing ?? 0;
        this._humEnabled = true;
        this._humSeed = settings.seed ?? -1;
        if (settings.seed !== undefined) {
            this.humanizeRng = new SeededRandom(settings.seed);
        }
        return this;
    }

    /**
     * Get current humanization settings.
     */
    getHumanizeSettings(): HumanizeSettings | null {
        if (!this._humEnabled) return null;
        const out: HumanizeSettings = { velocity: this._humVel, timing: this._humTiming };
        if (this._humSeed >= 0) out.seed = this._humSeed;
        return out;
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
     * No options objects - use strength and duration params directly.
     * @param grid - Grid size in beats (e.g., 0.25 = 16th notes)
     * @param strength - Snap strength 0-1 (default 1)
     * @param duration - Quantize duration too (default false)
     */
    quantize(grid: number, strength?: number, duration?: boolean): this {
        this._quantizeSettings = {
            grid,
            strength,
            duration
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
     * No options objects - use from, to, curve params directly.
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 0.4)
     * @param to - End velocity (default 1.0)
     * @param curve - Curve type (default LINEAR)
     */
    crescendo(duration: number, from: number = 0.4, to: number = 1.0, curve: CurveType = CurveType.LINEAR): this {
        this._dynType = DynamicsType.CRESCENDO;
        this._dynStart = this.getCurrentTick();
        this._dynDuration = duration;
        this._dynFrom = from;
        this._dynTo = to;
        this._dynCurve = curve;
        this.velocityCurvePoints = null;
        return this;
    }

    /**
     * Start a decrescendo (gradual decrease in velocity).
     * No options objects - use from, to, curve params directly.
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 1.0)
     * @param to - End velocity (default 0.4)
     * @param curve - Curve type (default LINEAR)
     */
    decrescendo(duration: number, from: number = 1.0, to: number = 0.4, curve: CurveType = CurveType.LINEAR): this {
        this._dynType = DynamicsType.DECRESCENDO;
        this._dynStart = this.getCurrentTick();
        this._dynDuration = duration;
        this._dynFrom = from;
        this._dynTo = to;
        this._dynCurve = curve;
        this.velocityCurvePoints = null;
        return this;
    }

    /**
     * Ramp velocity to a target value over a duration.
     * No options objects - use from param directly.
     * @param to - Target velocity (0-1)
     * @param duration - Duration in ticks
     * @param from - Start velocity (default 0.8)
     */
    velocityRamp(to: number, duration: number, from: number = 0.8): this {
        this._dynType = DynamicsType.RAMP;
        this._dynStart = this.getCurrentTick();
        this._dynDuration = duration;
        this._dynFrom = from;
        this._dynTo = to;
        this._dynCurve = CurveType.LINEAR;
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

        // Sort points by tick offset (in place, zero-allocation)
        points.sort(sortVelocityPoints);

        this._dynType = DynamicsType.CURVE;
        this._dynStart = this.getCurrentTick();
        this._dynDuration = duration;
        this._dynFrom = points[0].velocity;
        this._dynTo = points[points.length - 1].velocity;
        this.velocityCurvePoints = points;
        return this;
    }

    /**
     * Calculate velocity based on active dynamics at a given tick.
     * @param tick - Current tick position
     * @param baseVelocity - Base velocity to use if no dynamics active
     * @returns Calculated velocity (0-1)
     */
    protected calculateDynamicsVelocity(tick: number, baseVelocity: number): number {
        if (this._dynType === DynamicsType.NONE) {
            return baseVelocity;
        }

        const elapsed = tick - this._dynStart;

        // Check if dynamics have expired
        if (elapsed >= this._dynDuration) {
            this._dynType = DynamicsType.NONE;
            this.velocityCurvePoints = null;
            return baseVelocity;
        }

        // Handle custom curve
        if (this._dynType === DynamicsType.CURVE && this.velocityCurvePoints) {
            return this.interpolateCurveVelocity(elapsed, this.velocityCurvePoints);
        }

        // Calculate progress (0-1)
        const progress = elapsed / this._dynDuration;

        // Apply curve transformation
        const easedProgress = this.applyCurve(progress, this._dynCurve);

        // Linear interpolation between from and to
        return this._dynFrom + (this._dynTo - this._dynFrom) * easedProgress;
    }

    /**
     * Apply curve transformation to progress value.
     */
    protected applyCurve(progress: number, curve: CurveType): number {
        switch (curve) {
            case CurveType.LINEAR:
                return progress;
            case CurveType.EXPONENTIAL:
                return progress * progress;
            case CurveType.EASE_IN:
                return progress * progress * progress;
            case CurveType.EASE_OUT:
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
     * Return clip name metadata.
     */
    getClipName(): string {
        return this.clipName;
    }

    /**
     * Build and return ClipNode metadata.
     * Task 058 strict mode: note operation materialization is removed.
     */
    build(): ClipNode {
        return {
            _version: SCHEMA_VERSION,
            kind: 'clip',
            name: this.clipName,
            operations: [],
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

    toOperations(): ClipNode['operations'] {
        return [];
    }

    /**
     * Freeze clip metadata and kernel reference for reuse.
     * Task 058 strict mode: no operation snapshot is created.
     */
    freeze(options?: FreezeOptions): FrozenClip {
        const freezeOpts: FreezeOptions = {
            bpm: options?.bpm ?? this.currentTempo,
            timeSignature: options?.timeSignature ?? [this.timeSignatureNumerator, this.timeSignatureDenominator]
        };
        return new FrozenClip(this, freezeOpts);
    }

    /**
     * Visit notes currently committed in the backing kernel bridge.
     */
    visitKernelNotes(
        cb: (sourceId: number, pitch: number, velocity: number, duration: number, tick: number, muted: boolean, expressionId?: number) => void
    ): void {
        this.bridge.traverseNotes(cb as any);
    }

    /**
     * Task 063: Push current state onto pre-allocated stack (zero-allocation).
     * Call popState() to restore. Max depth: 16.
     */
    pushState(): this {
        if (this._stackPtr >= SynapticClip.MAX_STACK_DEPTH) {
            throw new Error('SynapticClip: state stack overflow (max 16)');
        }
        const base = this._stackPtr * SynapticClip.STACK_FRAME_SIZE;
        this._stateStackNum[base + 0] = this.currentTempo;
        this._stateStackNum[base + 1] = this._dynType;
        this._stateStackNum[base + 2] = this._dynStart;
        this._stateStackNum[base + 3] = this._dynDuration;
        this._stateStackNum[base + 4] = this._dynFrom;
        this._stateStackNum[base + 5] = this._dynTo;
        this._stateStackNum[base + 6] = this._dynCurve;
        this._stateStackNum[base + 7] = this.timeSignatureNumerator;
        this._stateStackNum[base + 8] = this.timeSignatureDenominator;
        this._stateStackCurve[this._stackPtr] = this.velocityCurvePoints;
        this._stackPtr++;
        return this;
    }

    /**
     * Task 063: Pop state from stack and restore (zero-allocation).
     */
    popState(): this {
        if (this._stackPtr <= 0) {
            throw new Error('SynapticClip: state stack underflow');
        }
        this._stackPtr--;
        const base = this._stackPtr * SynapticClip.STACK_FRAME_SIZE;
        this.currentTempo = this._stateStackNum[base + 0];
        this._dynType = this._stateStackNum[base + 1] as DynamicsType;
        this._dynStart = this._stateStackNum[base + 2];
        this._dynDuration = this._stateStackNum[base + 3];
        this._dynFrom = this._stateStackNum[base + 4];
        this._dynTo = this._stateStackNum[base + 5];
        this._dynCurve = this._stateStackNum[base + 6] as CurveType;
        this.velocityCurvePoints = this._stateStackCurve[this._stackPtr];
        this._stateStackCurve[this._stackPtr] = null;
        this.timeSignatureNumerator = this._stateStackNum[base + 7];
        this.timeSignatureDenominator = this._stateStackNum[base + 8];
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
        if (!precise && this._humEnabled) {
            this.applyHumanizeSettings(dynamicsVel, swungTick);
            humanizedVel = this._humanizeVelOut;
            humanizedTick = this._humanizeTickOut;
        } else if (!precise) {
            // Legacy micro-variation for backward compatibility
            humanizedVel = this.applyHumanization(dynamicsVel);
        }

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

        // 7. Final kernel insertion (Task 058: direct write, no operations push)
        const finalVel = Math.floor(humanizedVel * 127);
        const finalExpressionId = (expressionId && expressionId !== 0) ? expressionId : (this._expressionId ?? undefined);
        const ptr = this.bridge.insertAsync(
            OPCODE.NOTE,
            finalPitch,
            finalVel,
            quantizedDuration,
            humanizedTick,
            muted,
            sourceId,
            this.exitId,
            finalExpressionId
        );

        // 8. Update Topology (Generic SynapticNode support)
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
     * Writes result to _humanizeVelOut and _humanizeTickOut (no allocation).
     * @param velocity - Input velocity (0-1)
     * @param tick - Input tick
     */
    protected applyHumanizeSettings(velocity: number, tick: number): void {
        this._humanizeVelOut = velocity;
        this._humanizeTickOut = tick;

        if (this._humVel > 0) {
            const velVariation = (this.humanizeRng.next() - 0.5) * 2 * this._humVel;
            this._humanizeVelOut = Math.max(0, Math.min(1, velocity + velVariation));
        }

        if (this._humTiming > 0) {
            const msPerBeat = 60000 / this.currentTempo;
            const maxOffsetBeats = this._humTiming / msPerBeat;
            const timingVariation = (this.humanizeRng.next() - 0.5) * 2 * maxOffsetBeats;
            this._humanizeTickOut = tick + timingVariation;
        }
    }

    /**
     * Print ASCII visualization of the clip to console.
     * @param bpm - Tempo for display (default: 120)
     * @returns this for chaining
     */
    preview(bpm: number = 120): this {
        const notePitches: number[] = [];
        const noteTicks: number[] = [];
        const noteDurations: number[] = [];
        this.visitKernelNotes((_sourceId, pitch, velocity, duration, tick) => {
            if (velocity > 0) {
                notePitches.push(pitch);
                noteTicks.push(tick);
                noteDurations.push(duration);
            }
        });

        if (notePitches.length === 0) {
            console.log(`Clip: ${this.clipName} (${bpm} BPM)`);
            console.log('(empty)');
            return this;
        }

        // Find time range
        let maxTick = 0;
        for (let i = 0; i < notePitches.length; i++) {
            const endTick = noteTicks[i] + noteDurations[i];
            if (endTick > maxTick) {
                maxTick = endTick;
            }
        }
        const totalBars = Math.ceil(maxTick / 4); // 4 beats per bar
        const barsToShow = Math.max(totalBars, 1);

        // Grid resolution: 16th notes (4 per beat, 16 per bar)
        const stepsPerBar = 16;
        const totalSteps = barsToShow * stepsPerBar;
        const stepDuration = 0.25; // 1/16th note in beats

        // Collect unique pitches, sorted high to low
        const pitches = [...new Set(notePitches)].sort((a, b) => b - a);

        // Build grid for each pitch
        const grid: Map<number, string[]> = new Map();
        for (const pitch of pitches) {
            grid.set(pitch, new Array(totalSteps).fill('.'));
        }

        // Fill in notes
        for (let i = 0; i < notePitches.length; i++) {
            const pitch = notePitches[i];
            const tick = noteTicks[i];
            const duration = noteDurations[i];
            const pitchGrid = grid.get(pitch);
            if (!pitchGrid) continue;

            const startStep = Math.floor(tick / stepDuration);
            const durationSteps = Math.ceil(duration / stepDuration);

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
        console.log(`Clip: ${this.clipName} (${bpm} BPM)`);

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
