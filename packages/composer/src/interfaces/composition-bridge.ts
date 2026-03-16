import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { ExecutionContext } from '@symphonyscript/core'

/**
 * Main interface for the composition API. Provides read-only composition state
 * (tick, velocity, transpose, etc.) and pure methods that accumulate deferred
 * thunks; {@link commit} executes them against an {@link ExecutionContext}.
 *
 * **Lifecycle**: Build state and events via fluent `withNote`, `withCC`,
 * `withVelocity`, etc. Each call returns a new bridge with appended thunk or
 * updated state — no mutation. Call `commit(context)` to emit events into the
 * context.
 *
 * {@link BaseCompositionBridge} is the canonical implementation. Decorators such
 * as {@link CompositionBridgeDecorator} wrap bridges to intercept and transform
 * events (e.g. {@link TieBridge}, {@link HarmonizeBridge}).
 */
export interface CompositionBridge {
    /** Current position in ticks (PPQ 480). */
    readonly tick: number
    /** Default velocity (0–1000) for notes when omitted. */
    readonly velocity: number
    /** Transpose offset in semitones. */
    readonly transpose: number
    /** Default note duration in ticks when omitted in withNote. */
    readonly defaultDuration: number
    /** Tempo in BPM. */
    readonly tempo: number
    /** Time signature numerator. */
    readonly timeSignatureNum: number
    /** Time signature denominator. */
    readonly timeSignatureDen: number
    /** Scale root pitch class (0–11). */
    readonly scaleRoot: PitchClass
    /** Scale mode (e.g. MAJOR, MINOR). */
    readonly scaleMode: ScaleMode
    /** Key root when in a key context, or null. */
    readonly keyRoot: PitchClass | null
    /** Key mode when keyRoot is set. */
    readonly keyMode: ScaleMode
    /** Volume (0–127). Tracked and emitted as CC7 on change. */
    readonly volume: number
    /** Pan (0–127, 64 = center). Tracked and emitted as CC10 on change. */
    readonly pan: number
    /** Swing amount (0.0–1.0). */
    readonly swing: number
    /** Whether notes are muted. */
    readonly muted: boolean
    /** When true, skips humanization. */
    readonly precise: boolean
    /** Quantize grid in ticks. 0 = no quantize. */
    readonly quantizeGrid: number
    /** Quantize strength (0–1). */
    readonly quantizeStrength: number

    // === Continuous Pitch State (RFC-060) ===

    /** Scale root as absolute cents from C0. */
    readonly scaleRootCents: number
    /** Key root as absolute cents from C0, or null. */
    readonly keyRootCents: number | null
    /** Current scale interval array (cents), or null. */
    readonly scaleIntervals: readonly number[] | null
    /** Current temperament chromatic array (cents), or null. */
    readonly temperament: readonly number[] | null
    /** Reference pitch frequency in Hz. */
    readonly tuningHz: number
    /** Transpose offset in cents. */
    readonly transposeCents: number

    // === Deferred Event Methods (pure — accumulate thunks, no side effects) ===

    /**
     * Defer a note. Uses tick/velocity from state unless overridden. Returns new
     * bridge with advanced tick and thunk appended.
     *
     * @param pitch - MIDI pitch (0–127).
     * @param duration - Note duration in ticks. Default: bridge.defaultDuration.
     * @param velocity - Note velocity (0–1000). Default: bridge.velocity.

     * @returns New bridge with the note thunk and tick advanced by duration.
     */
    withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge

    /**
     * Defer a MIDI CC at current tick.
     *
     * @param controller - MIDI CC number (0–127).
     * @param value - CC value (0–127).

     * @returns New bridge with the CC thunk appended.
     */
    withCC(controller: number, value: number): CompositionBridge

    /**
     * Defer a pitch bend at current tick.
     *
     * @param value - 14-bit pitch bend (typically -8192 to 8191).

     * @returns New bridge with the bend thunk appended.
     */
    withBend(value: number): CompositionBridge

    /**
     * Defer aftertouch at current tick. Omit pitch for channel pressure;
     * provide pitch for polyphonic aftertouch.
     *
     * @param value - Aftertouch pressure (0–127).
     * @param pitch - MIDI pitch for poly aftertouch. Omit for channel aftertouch.

     * @returns New bridge with the aftertouch thunk appended.
     */
    withAftertouch(value: number, pitch?: number): CompositionBridge

    // === Deferred Topology (pure — accumulate thunks) ===

    /**
     * Defer a synapse connection.
     *
     * @param srcId - Source node id.
     * @param tgtId - Target node id.
     * @param weight - Connection weight. Default: 1.

     * @returns New bridge with the connect thunk appended.
     */
    withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge

    /**
     * Defer a synapse disconnection.
     *
     * @param srcId - Source node id.
     * @param tgtId - Target node id.

     * @returns New bridge with the disconnect thunk appended.
     */
    withDisconnect(srcId: number, tgtId: number): CompositionBridge

    /**
     * Defer a node reclamation.
     *
     * @param nodePtr - Node pointer to reclaim.

     * @returns New bridge with the reclaim thunk appended.
     */
    withReclaim(nodePtr: number): CompositionBridge

    // === Immutable State Modifiers (pure — return new bridge with updated state) ===

    /**
     * Return new bridge with specified velocity.
     *
     * @param v - Velocity (0–1000).

     * @returns New bridge with updated velocity.
     */
    withVelocity(v: number): CompositionBridge

    /**
     * Return new bridge with specified transpose offset.
     *
     * @param s - Transpose in semitones.

     * @returns New bridge with updated transpose.
     */
    withTranspose(s: number): CompositionBridge

    /**
     * Return new bridge with specified default duration.
     *
     * @param d - Duration in ticks.

     * @returns New bridge with updated defaultDuration.
     */
    withDefaultDuration(d: number): CompositionBridge

    /**
     * Return new bridge with specified tempo.
     *
     * @param bpm - Tempo in BPM.

     * @returns New bridge with updated tempo.
     */
    withTempo(bpm: number): CompositionBridge

    /**
     * Return new bridge with specified time signature.
     *
     * @param num - Numerator (e.g. 4).
     * @param den - Denominator (e.g. 4).

     * @returns New bridge with updated time signature.
     */
    withTimeSignature(num: number, den: number): CompositionBridge

    /**
     * Return new bridge with specified scale context.
     *
     * @param root - Scale root pitch class (0–11).
     * @param mode - Scale mode.

     * @returns New bridge with updated scale context.
     */
    withScale(root: PitchClass, mode: ScaleMode): CompositionBridge

    /**
     * Return new bridge with specified key context.
     *
     * @param root - Key root pitch class (0–11).
     * @param mode - Key mode when root is set.

     * @returns New bridge with updated key context.
     */
    withKey(root: PitchClass, mode: ScaleMode): CompositionBridge

    /**
     * Return new bridge with specified volume. Emits CC7 and tracks state.
     *
     * @param v - Volume (0–127).

     * @returns New bridge with updated volume.
     */
    withVolume(v: number): CompositionBridge

    /**
     * Return new bridge with specified pan. Emits CC10 and tracks state.
     *
     * @param v - Pan (0–127, 64 = center).

     * @returns New bridge with updated pan.
     */
    withPan(v: number): CompositionBridge

    /**
     * Return new bridge with specified swing amount.
     *
     * @param amount - Swing (0.0–1.0).

     * @returns New bridge with updated swing.
     */
    withSwing(amount: number): CompositionBridge

    /**
     * Return new bridge with quantize settings.
     *
     * @param grid - Quantize grid in ticks. 0 = no quantize.
     * @param strength - Quantize strength (0–1). Default: 1.0.

     * @returns New bridge with updated quantize settings.
     */
    withQuantize(grid: number, strength?: number): CompositionBridge

    /**
     * Return new bridge with specified tick position.
     *
     * @param tick - Position in ticks.

     * @returns New bridge with updated tick.
     */
    withTick(tick: number): CompositionBridge

    /**
     * Return new bridge with muted flag.
     *
     * @param muted - Whether notes are muted.

     * @returns New bridge with updated muted.
     */
    withMuted(muted: boolean): CompositionBridge

    /**
     * Return new bridge with precise flag.
     *
     * @param precise - When true, skips humanization.

     * @returns New bridge with updated precise.
     */
    withPrecise(precise: boolean): CompositionBridge

    // === Continuous Pitch Modifiers (RFC-060) ===

    /**
     * Return new bridge with specified scale root in cents.
     *
     * @param cents - Absolute cents from C0.
     */
    withScaleRootCents(cents: number): CompositionBridge

    /**
     * Return new bridge with specified key root in cents.
     *
     * @param cents - Absolute cents from C0, or null to clear.
     */
    withKeyRootCents(cents: number | null): CompositionBridge

    /**
     * Return new bridge with specified scale intervals.
     *
     * @param intervals - Scale interval array (cents from root).
     */
    withScaleIntervals(intervals: readonly number[]): CompositionBridge

    /**
     * Return new bridge with specified temperament.
     *
     * @param t - Chromatic interval array (cents from root).
     */
    withTemperament(t: readonly number[]): CompositionBridge

    /**
     * Return new bridge with specified tuning reference.
     *
     * @param hz - Reference frequency in Hz.
     */
    withTuningHz(hz: number): CompositionBridge

    /**
     * Return new bridge with specified transpose offset in cents.
     *
     * @param cents - Transpose offset in cents.
     */
    withTransposeCents(cents: number): CompositionBridge

    // === Commit (side effects — execute all accumulated thunks) ===

    /**
     * Execute all accumulated thunks inside the provided execution context.
     *
     * @param context - Execution context (e.g. recorder) that receives the events.
     */
    commit(context: ExecutionContext): void
}
