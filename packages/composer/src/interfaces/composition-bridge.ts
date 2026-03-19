import { ExecutionContext, Notation } from '@symphonyscript/core'

/**
 * Main interface for the composition API. Provides read-only composition state
 * and pure methods that accumulate deferred thunks; {@link commit} executes
 * them against an {@link ExecutionContext}.
 *
 * The bridge is **notation-agnostic** — it only deals with cents, interval
 * arrays, and numeric state. String-to-number resolution (note names, scale
 * mode names) is the responsibility of the cue/builder layer above.
 *
 * {@link BaseCompositionBridge} is the canonical implementation. Decorators
 * such as {@link CompositionBridgeDecorator} wrap bridges to intercept and
 * transform events (e.g. {@link TieBridge}, {@link HarmonizeBridge}).
 */
export interface CompositionBridge {
    /** Pulses per quarter note (tick resolution); used at output boundary. */
    readonly ppq: number
    /** Current position in beats (quarter-note = 1). */
    readonly tick: number
    /** Default velocity (0–1000) for notes when omitted. */
    readonly velocity: number
    /** Default note duration in beats when omitted in withNote. */
    readonly defaultDuration: number
    /** Tempo in BPM. */
    readonly tempo: number
    /** Time signature numerator. */
    readonly timeSignatureNum: number
    /** Time signature denominator. */
    readonly timeSignatureDen: number
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
    /** Quantize grid in beats. 0 = no quantize. */
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

    notation(): Notation

    // === Deferred Events (pure — accumulate thunks) ===

    /**
     * Defer a note at current position.
     *
     * @param pitch - Pitch in absolute cents from C0.
     * @param duration - Note duration in beats. Default: bridge.defaultDuration.
     * @param velocity - Note velocity (0–1000). Default: bridge.velocity.
     */
    withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge

    /**
     * Defer a MIDI CC at current position.
     *
     * @param controller - MIDI CC number (0–127).
     * @param value - CC value (0–127).
     */
    withCC(controller: number, value: number): CompositionBridge

    /**
     * Defer a pitch bend at current position.
     *
     * @param value - 14-bit pitch bend.
     */
    withBend(value: number): CompositionBridge

    /**
     * Defer aftertouch. Omit pitch for channel pressure; provide for poly aftertouch.
     *
     * @param value - Aftertouch pressure (0–127).
     * @param pitch - Optional pitch for poly aftertouch.
     */
    withAftertouch(value: number, pitch?: number): CompositionBridge

    // === Deferred Topology ===

    withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge
    withDisconnect(srcId: number, tgtId: number): CompositionBridge
    withReclaim(nodePtr: number): CompositionBridge

    // === Immutable State Modifiers ===

    withVelocity(v: number): CompositionBridge
    withDefaultDuration(d: number): CompositionBridge
    withTempo(bpm: number): CompositionBridge
    withTimeSignature(num: number, den: number): CompositionBridge
    withVolume(v: number): CompositionBridge
    withPan(v: number): CompositionBridge
    withSwing(amount: number): CompositionBridge
    withQuantize(grid: number, strength?: number): CompositionBridge
    withTick(tick: number): CompositionBridge
    withMuted(muted: boolean): CompositionBridge
    withPrecise(precise: boolean): CompositionBridge

    // === Continuous Pitch Modifiers (RFC-060) ===

    withScaleRootCents(cents: number): CompositionBridge
    withKeyRootCents(cents: number | null): CompositionBridge
    withScaleIntervals(intervals: readonly number[]): CompositionBridge
    withTemperament(t: readonly number[] | null): CompositionBridge
    withTuningHz(hz: number): CompositionBridge
    withTransposeCents(cents: number): CompositionBridge

    // === Commit ===

    /**
     * Execute all accumulated thunks inside the provided execution context.
     *
     * @param context - Execution context that receives the events.
     */
    commit(context: ExecutionContext): void
}
