import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { ExecutionContext } from '@symphonyscript/core'

export interface CompositionBridge {
    readonly tick: number
    readonly velocity: number
    readonly transpose: number
    readonly defaultDuration: number
    readonly tempo: number
    readonly timeSignatureNum: number
    readonly timeSignatureDen: number
    readonly scaleRoot: number
    readonly scaleMode: ScaleMode
    readonly keyRoot: number
    readonly keyMode: ScaleMode
    readonly swing: number
    readonly muted: boolean
    readonly precise: boolean
    readonly quantizeGrid: number
    readonly quantizeStrength: number

    // === Deferred Event Methods (pure — accumulate thunks, no side effects) ===

    /** Defer a note. Uses tick/velocity from state unless overridden. Returns new bridge with advanced tick + thunk appended. */
    withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge

    /** Defer a MIDI CC at current tick. */
    withCC(controller: number, value: number): CompositionBridge

    /** Defer a pitch bend at current tick. */
    withBend(value: number): CompositionBridge

    /** Defer aftertouch at current tick. Omit pitch for channel, provide pitch for poly. */
    withAftertouch(value: number, pitch?: number): CompositionBridge

    // === Deferred Topology (pure — accumulate thunks) ===

    /** Defer a synapse connection. */
    withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge

    /** Defer a synapse disconnection. */
    withDisconnect(srcId: number, tgtId: number): CompositionBridge

    /** Defer a node reclamation. */
    withReclaim(nodePtr: number): CompositionBridge

    // === Immutable State Modifiers (pure — return new bridge with updated state) ===

    /** Return new bridge with specified velocity. */
    withVelocity(v: number): CompositionBridge

    /** Return new bridge with specified transpose offset. */
    withTranspose(s: number): CompositionBridge

    /** Return new bridge with specified default duration. */
    withDefaultDuration(d: number): CompositionBridge

    /** Return new bridge with specified tempo. */
    withTempo(bpm: number): CompositionBridge

    /** Return new bridge with specified time signature. */
    withTimeSignature(num: number, den: number): CompositionBridge

    /** Return new bridge with specified scale context. */
    withScale(root: PitchClass, mode: ScaleMode): CompositionBridge

    /** Return new bridge with specified key context. */
    withKey(root: PitchClass, mode: ScaleMode): CompositionBridge

    /** Return new bridge with specified swing amount (0.0–1.0). */
    withSwing(amount: number): CompositionBridge

    /** Return new bridge with quantize settings. */
    withQuantize(grid: number, strength?: number): CompositionBridge

    /** Return new bridge with specified tick position. */
    withTick(tick: number): CompositionBridge

    /** Return new bridge with muted flag. */
    withMuted(muted: boolean): CompositionBridge

    /** Return new bridge with precise flag (skip humanization). */
    withPrecise(precise: boolean): CompositionBridge

    // === Commit (side effects — execute all accumulated thunks) ===

    /** Execute all accumulated thunks inside the provided execution context. */
    commit(context: ExecutionContext): void
}
