import { ExecutionContext, Notation } from '@symphonyscript/core'
import { Scale } from '@symphonyscript/theory'
import { MIDI_CC } from '@symphonyscript/theory-legacy'
import { CompositionBridge } from '@symphonyscript/composer'
import { ThunkNode } from '../interfaces/thunk-node'

/**
 * Constructor parameters for {@link BaseCompositionBridge}.
 * All fields are optional; defaults are applied when omitted.
 */
export interface BaseCompositionBridgeParams {
  /** Default notation to use for user-ergonomics (parsing notes, conversion, etc) */
  notation: Notation
  /** Current position in beats (quarter-note = 1). Default: 0 */
  tick: number
  /** Pulses per quarter note (tick resolution); used at output boundary. Default: 480 */
  ppq: number
  /** Default velocity (0–1000). Default: 800 */
  velocity: number
  /** Default note duration in beats when omitted in withNote. Default: 1 */
  defaultDuration: number
  /** Tempo in BPM. Default: 120 */
  tempo: number
  /** Time signature numerator. Default: 4 */
  timeSignatureNum: number
  /** Time signature denominator. Default: 4 */
  timeSignatureDen: number
  /** Volume (0–127). Emitted as CC7 on change. Default: 100 */
  volume: number
  /** Pan (0–127, 64 = center). Emitted as CC10 on change. Default: 64 */
  pan: number
  /** Swing amount (0.0–1.0). Default: 0 */
  swing: number
  /** Whether notes are muted. Default: false */
  muted: boolean
  /** When true, skips humanization. Default: false */
  precise: boolean
  /** Quantize grid in beats. 0 = no quantize. Default: 0 */
  quantizeGrid: number
  /** Quantize strength (0–1). Default: 1.0 */
  quantizeStrength: number
  /** Head of the thunk chain; null if no deferred events. Default: null */
  tail: ThunkNode | null
  /** Count of deferred thunks. Default: 0 */
  length: number

  // --- Continuous Pitch State (RFC-060) ---

  /** Scale root as absolute cents from C0. Default: 0 */
  scaleRootCents: number
  /** Key root as absolute cents, or null. Default: null */
  keyRootCents: number | null
  /** Current scale interval array (cents). Default: null */
  scaleIntervals: readonly number[] | null
  /** Current temperament chromatic array (cents). Default: null */
  temperament: readonly number[] | null
  /** Reference pitch in Hz. Default: 440 */
  tuningHz: number
  /** Transpose offset in cents. Default: 0 */
  transposeCents: number
}

/**
 * Core composition bridge that accumulates notes, CC events, and pitch bends
 * as deferred thunks. Each `withNote`, `withCC`, `withBend`, etc. appends a
 * callback to an immutable linked list; `commit` executes thunks in reverse
 * order (oldest first) against the provided {@link ExecutionContext}.
 *
 * Immutable — every modifier returns a new bridge instance. State (tick,
 * velocity, etc.) is tracked and applied when emitting events.
 *
 * The bridge is **notation-agnostic** — it only deals with cents, interval
 * arrays, and numeric state. String-to-number resolution (e.g. note names,
 * scale mode names) is the responsibility of the cue/builder layer above.
 *
 * @example
 * ```ts
 * const bridge = new BaseCompositionBridge({ notation })
 *   .withVelocity(100)
 *   .withNote(6000, 480)
 *   .withCC(7, 80)
 * bridge.commit(recorder)
 * ```
 */
export class BaseCompositionBridge implements CompositionBridge {
  protected readonly params: BaseCompositionBridgeParams

  /**
   * @param params - Partial params; missing fields use defaults from {@link BaseCompositionBridgeParams}
   */
  constructor(params: { notation: Notation } & Partial<BaseCompositionBridgeParams>) {
    this.params = {
      notation: params.notation,
      tick: params.tick ?? 0,
      ppq: params.ppq ?? 480,
      velocity: params.velocity ?? 800,
      defaultDuration: params.defaultDuration ?? 1,
      tempo: params.tempo ?? 120,
      timeSignatureNum: params.timeSignatureNum ?? 4,
      timeSignatureDen: params.timeSignatureDen ?? 4,
      volume: params.volume ?? 100,
      pan: params.pan ?? 64,
      swing: params.swing ?? 0,
      muted: params.muted ?? false,
      precise: params.precise ?? false,
      quantizeGrid: params.quantizeGrid ?? 0,
      quantizeStrength: params.quantizeStrength ?? 1.0,
      tail: params.tail ?? null,
      length: params.length ?? 0,
      scaleRootCents: params.scaleRootCents ?? 0,
      keyRootCents: params.keyRootCents ?? null,
      scaleIntervals: params.scaleIntervals ?? Scale.Ionian,
      temperament: params.temperament ?? null,
      tuningHz: params.tuningHz ?? 440,
      transposeCents: params.transposeCents ?? 0,
    }
  }

  get tick() { return this.params.tick }
  get ppq() { return this.params.ppq }
  get velocity() { return this.params.velocity }
  get defaultDuration() { return this.params.defaultDuration }
  get tempo() { return this.params.tempo }
  get timeSignatureNum() { return this.params.timeSignatureNum }
  get timeSignatureDen() { return this.params.timeSignatureDen }
  get volume() { return this.params.volume }
  get pan() { return this.params.pan }
  get swing() { return this.params.swing }
  get muted() { return this.params.muted }
  get precise() { return this.params.precise }
  get quantizeGrid() { return this.params.quantizeGrid }
  get quantizeStrength() { return this.params.quantizeStrength }
  get scaleRootCents() { return this.params.scaleRootCents }
  get keyRootCents() { return this.params.keyRootCents }
  get scaleIntervals() { return this.params.scaleIntervals }
  get temperament() { return this.params.temperament }
  get tuningHz() { return this.params.tuningHz }
  get transposeCents() { return this.params.transposeCents }

  /**
   * Returns the notation instance.
   */
  notation(): Notation {
    return this.params.notation;
  }

  /**
   * Defer a note at the current position. Advances position by duration.
   * Applies transposeCents; uses default velocity when omitted. Emits a thunk that
   * calls `insertNote` on commit, converting beats→ticks at the output boundary.
   *
   * @param pitch - Pitch in absolute cents from C0
   * @param duration - Note duration in beats. Default: defaultDuration
   * @param velocity - Override velocity (0–1000). Default: this.velocity
   *
   * @returns New bridge with position advanced and note thunk appended
   */
  withNote(pitch: number, duration?: number, velocity?: number): BaseCompositionBridge {
    const dur = duration ?? this.params.defaultDuration
    const vel = velocity ?? this.params.velocity
    const finalPitch = pitch + this.params.transposeCents
    const beatPos = this.params.tick
    const muted = this.params.muted
    const ppq = this.params.ppq

    return this.derive({ tick: beatPos + dur }, ctx => {
      return ctx.insertNote(finalPitch, vel, Math.round(dur * ppq), Math.round(beatPos * ppq), muted, 0)
    })
  }

  /**
   * Defer a MIDI CC event at the current position.
   *
   * @param controller - MIDI CC number (0–127)
   * @param value - CC value (0–127)
   *
   * @returns New bridge with CC thunk appended
   */
  withCC(controller: number, value: number): BaseCompositionBridge {
    const beatPos = this.params.tick
    const ppq = this.params.ppq

    return this.derive({}, ctx => ctx.insertCC(controller, value, Math.round(beatPos * ppq), 0))
  }

  /**
   * Defer a pitch bend event at the current position.
   *
   * @param value - Pitch bend value (14-bit: 0 = full down, 8192 = center, 16383 = full up)
   *
   * @returns New bridge with bend thunk appended
   */
  withBend(value: number): BaseCompositionBridge {
    const beatPos = this.params.tick
    const ppq = this.params.ppq

    return this.derive({}, ctx => ctx.insertBend(value, Math.round(beatPos * ppq), 0))
  }

  /**
   * Defer aftertouch at the current position. Channel aftertouch when pitch omitted;
   * poly aftertouch when pitch provided.
   *
   * @param value - Aftertouch value (0–127)
   * @param pitch - Optional MIDI pitch for poly aftertouch; omit for channel aftertouch
   *
   * @returns New bridge with aftertouch thunk appended
   */
  withAftertouch(value: number, pitch?: number): BaseCompositionBridge {
    const beatPos = this.params.tick
    const ppq = this.params.ppq

    if (pitch !== undefined) {
      return this.derive({}, ctx => ctx.insertCC(0xA0, value, Math.round(beatPos * ppq), pitch))
    }
    return this.derive({}, ctx => ctx.insertCC(0xD0, value, Math.round(beatPos * ppq), 0))
  }

  /**
   * Defer a synapse connection between nodes.
   *
   * @param srcId - Source node id
   * @param tgtId - Target node id
   * @param weight - Optional connection weight
   *
   * @returns New bridge with connect thunk appended
   */
  withConnect(srcId: number, tgtId: number, weight?: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.connect(srcId, tgtId, weight))
  }

  /**
   * Defer a synapse disconnection.
   *
   * @param srcId - Source node id
   * @param tgtId - Target node id
   *
   * @returns New bridge with disconnect thunk appended
   */
  withDisconnect(srcId: number, tgtId: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.disconnect(srcId, tgtId))
  }

  /**
   * Defer node reclamation.
   *
   * @param nodePtr - Node pointer to reclaim
   *
   * @returns New bridge with reclaim thunk appended
   */
  withReclaim(nodePtr: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.reclaim(nodePtr))
  }

  /**
   * Return a new bridge with the given velocity. Affects subsequent withNote calls.
   *
   * @param v - Velocity (0–1000)
   *
   * @returns New bridge with updated velocity
   */
  withVelocity(v: number): BaseCompositionBridge {
    return this.derive({ velocity: v })
  }

  /**
   * Return a new bridge with the given default duration in beats.
   *
   * @param d - Default duration in beats (quarter-note = 1)
   *
   * @returns New bridge with updated defaultDuration
   */
  withDefaultDuration(d: number): BaseCompositionBridge {
    return this.derive({ defaultDuration: d })
  }

  /**
   * Return a new bridge with the given tempo.
   *
   * @param bpm - Tempo in BPM
   *
   * @returns New bridge with updated tempo
   */
  withTempo(bpm: number): BaseCompositionBridge {
    return this.derive({ tempo: bpm })
  }

  /**
   * Return a new bridge with the given time signature.
   *
   * @param num - Numerator (e.g. 4 for 4/4)
   * @param den - Denominator (e.g. 4 for 4/4)
   *
   * @returns New bridge with updated time signature
   */
  withTimeSignature(num: number, den: number): BaseCompositionBridge {
    return this.derive({ timeSignatureNum: num, timeSignatureDen: den })
  }

  /**
   * Return a new bridge with the given volume. Emits CC7 at current position and tracks state.
   *
   * @param v - Volume (0–127)
   *
   * @returns New bridge with volume CC thunk appended
   */
  withVolume(v: number): BaseCompositionBridge {
    const beatPos = this.params.tick
    const ppq = this.params.ppq
    return this.derive({ volume: v }, ctx => ctx.insertCC(MIDI_CC.VOLUME, v, Math.round(beatPos * ppq), 0))
  }

  /**
   * Return a new bridge with the given pan. Emits CC10 at current position and tracks state.
   *
   * @param v - Pan (0–127, 64 = center)
   *
   * @returns New bridge with pan CC thunk appended
   */
  withPan(v: number): BaseCompositionBridge {
    const beatPos = this.params.tick
    const ppq = this.params.ppq
    return this.derive({ pan: v }, ctx => ctx.insertCC(MIDI_CC.PAN, v, Math.round(beatPos * ppq), 0))
  }

  /**
   * Return a new bridge with the given swing amount.
   *
   * @param amount - Swing amount (0.0–1.0)
   *
   * @returns New bridge with updated swing
   */
  withSwing(amount: number): BaseCompositionBridge {
    return this.derive({ swing: amount })
  }

  /**
   * Return a new bridge with quantize settings.
   *
   * @param grid - Quantize grid in beats; 0 disables quantize
   * @param strength - Quantize strength (0–1). Default: 1.0
   *
   * @returns New bridge with updated quantize settings
   */
  withQuantize(grid: number, strength?: number): BaseCompositionBridge {
    return this.derive({ quantizeGrid: grid, quantizeStrength: strength ?? 1.0 })
  }

  /**
   * Return a new bridge with the given position.
   *
   * @param tick - Position in beats (quarter-note = 1)
   *
   * @returns New bridge with updated position
   */
  withTick(tick: number): BaseCompositionBridge {
    return this.derive({ tick })
  }

  /**
   * Return a new bridge with the muted flag.
   *
   * @param muted - Whether notes are muted
   *
   * @returns New bridge with updated muted state
   */
  withMuted(muted: boolean): BaseCompositionBridge {
    return this.derive({ muted })
  }

  /**
   * Return a new bridge with the precise flag. When true, skips humanization.
   *
   * @param precise - Whether to skip humanization
   *
   * @returns New bridge with updated precise state
   */
  withPrecise(precise: boolean): BaseCompositionBridge {
    return this.derive({ precise })
  }

  // === Continuous Pitch Modifiers (RFC-060) ===

  /** Return a new bridge with specified scale root in cents. */
  withScaleRootCents(cents: number): BaseCompositionBridge {
    return this.derive({ scaleRootCents: cents })
  }

  /** Return a new bridge with specified key root in cents (or null to clear). */
  withKeyRootCents(cents: number | null): BaseCompositionBridge {
    return this.derive({ keyRootCents: cents })
  }

  /** Return a new bridge with specified scale intervals. */
  withScaleIntervals(intervals: readonly number[]): BaseCompositionBridge {
    return this.derive({ scaleIntervals: intervals })
  }

  /** Return a new bridge with specified temperament. */
  withTemperament(t: readonly number[] | null): BaseCompositionBridge {
    return this.derive({ temperament: t })
  }

  /** Return a new bridge with specified tuning reference in Hz. */
  withTuningHz(hz: number): BaseCompositionBridge {
    return this.derive({ tuningHz: hz })
  }

  /** Return a new bridge with specified transpose offset in cents. */
  withTransposeCents(cents: number): BaseCompositionBridge {
    return this.derive({ transposeCents: cents })
  }

  /**
   * Execute all accumulated thunks in reverse order (oldest first) against the
   * provided execution context. Each thunk calls insertNote, insertCC,
   * insertBend, etc. on the context.
   *
   * @param context - Execution context (e.g. {@link RecordingBridge}) that receives events
   */
  commit(context: ExecutionContext): void {
    const thunks: ((ctx: ExecutionContext) => void)[] = []
    let current = this.params.tail

    while (current) {
      thunks.push(current.thunk)
      current = current.prev
    }

    for (let i = thunks.length - 1; i >= 0; --i) {
      thunks[i](context)
    }
  }

  /**
   * Create a new bridge with overridden params and optionally append a thunk.
   * Thunks are stored in a tail-first linked list; derive prepends the new thunk
   * to the chain.
   *
   * @internal
   * @param overrides - Params to merge over the current state
   * @param thunk - Optional callback to run on commit
   *
   * @returns New BaseCompositionBridge instance
   */
  private derive(
    overrides: Partial<BaseCompositionBridgeParams>,
    thunk?: (context: ExecutionContext) => void
  ): BaseCompositionBridge {
    return new BaseCompositionBridge(
      {
        ...this.params,
        ...overrides,
        tail: thunk ? { thunk, prev: this.params.tail } : this.params.tail,
        length: thunk ? this.params.length + 1 : this.params.length,
      },
    )
  }
}
