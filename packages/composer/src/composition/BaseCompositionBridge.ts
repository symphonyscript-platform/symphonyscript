import { ExecutionContext } from '@symphonyscript/core'
import { MIDI_CC, PitchClass, ScaleMode } from '@symphonyscript/theory'
import { CompositionBridge } from '@symphonyscript/composer'
import { ThunkNode } from '../interfaces/thunk-node'

/**
 * Constructor parameters for {@link BaseCompositionBridge}.
 * All fields are optional; defaults are applied when omitted.
 */
export interface BaseCompositionBridgeParams {
  /** Current tick position in ticks (PPQ 480). Default: 0 */
  tick: number
  /** Default velocity (0–127). Default: 800 */
  velocity: number
  /** Transpose offset in semitones. Default: 0 */
  transpose: number
  /** Default note duration when omitted in withNote. Default: 1 */
  defaultDuration: number
  /** Tempo in BPM. Default: 120 */
  tempo: number
  /** Time signature numerator. Default: 4 */
  timeSignatureNum: number
  /** Time signature denominator. Default: 4 */
  timeSignatureDen: number
  /** Scale root pitch class (0–11). Default: 0 */
  scaleRoot: PitchClass
  /** Scale mode (e.g. MAJOR, MINOR). Default: ScaleMode.MAJOR */
  scaleMode: ScaleMode
  /** Key root when in a key context, or null. Default: null */
  keyRoot: PitchClass | null
  /** Key mode when keyRoot is set. Default: ScaleMode.MAJOR */
  keyMode: ScaleMode
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
  /** Quantize grid in ticks. 0 = no quantize. Default: 0 */
  quantizeGrid: number
  /** Quantize strength (0–1). Default: 1.0 */
  quantizeStrength: number
  /** Head of the thunk chain; null if no deferred events. Default: null */
  tail: ThunkNode | null
  /** Count of deferred thunks. Default: 0 */
  length: number
}

/**
 * Core composition bridge that accumulates notes, CC events, and pitch bends
 * as deferred thunks. Each `withNote`, `withCC`, `withBend`, etc. appends a
 * callback to an immutable linked list; `commit` executes thunks in reverse
 * order (oldest first) against the provided {@link ExecutionContext}.
 *
 * Immutable — every modifier returns a new bridge instance. State (tick,
 * velocity, transpose, etc.) is tracked and applied when emitting events.
 *
 * @example
 * ```ts
 * const bridge = new BaseCompositionBridge()
 *   .withVelocity(100)
 *   .withNote(60, 480)
 *   .withCC(7, 80)
 * bridge.commit(recorder)
 * ```
 *
 * @example
 * ```ts
 * new BaseCompositionBridge({ tick: 960 })
 *   .withNote(64, 240)
 *   .commit(ctx)
 * ```
 */
export class BaseCompositionBridge implements CompositionBridge {
  protected readonly params: BaseCompositionBridgeParams

  /**
   * @param params - Partial params; missing fields use defaults from {@link BaseCompositionBridgeParams}
   */
  constructor(params: Partial<BaseCompositionBridgeParams> = {}) {
    this.params = {
      tick: params.tick ?? 0,
      velocity: params.velocity ?? 800,
      transpose: params.transpose ?? 0,
      defaultDuration: params.defaultDuration ?? 1,
      tempo: params.tempo ?? 120,
      timeSignatureNum: params.timeSignatureNum ?? 4,
      timeSignatureDen: params.timeSignatureDen ?? 4,
      scaleRoot: params.scaleRoot ?? (0 as PitchClass),
      scaleMode: params.scaleMode ?? ScaleMode.MAJOR,
      keyRoot: params.keyRoot ?? null,
      keyMode: params.keyMode ?? ScaleMode.MAJOR,
      volume: params.volume ?? 100,
      pan: params.pan ?? 64,
      swing: params.swing ?? 0,
      muted: params.muted ?? false,
      precise: params.precise ?? false,
      quantizeGrid: params.quantizeGrid ?? 0,
      quantizeStrength: params.quantizeStrength ?? 1.0,
      tail: params.tail ?? null,
      length: params.length ?? 0,
    }
  }

  get tick() { return this.params.tick }
  get velocity() { return this.params.velocity }
  get transpose() { return this.params.transpose }
  get defaultDuration() { return this.params.defaultDuration }
  get tempo() { return this.params.tempo }
  get timeSignatureNum() { return this.params.timeSignatureNum }
  get timeSignatureDen() { return this.params.timeSignatureDen }
  get scaleRoot() { return this.params.scaleRoot }
  get scaleMode() { return this.params.scaleMode }
  get keyRoot() { return this.params.keyRoot }
  get keyMode() { return this.params.keyMode }
  get volume() { return this.params.volume }
  get pan() { return this.params.pan }
  get swing() { return this.params.swing }
  get muted() { return this.params.muted }
  get precise() { return this.params.precise }
  get quantizeGrid() { return this.params.quantizeGrid }
  get quantizeStrength() { return this.params.quantizeStrength }

  /**
   * Defer a note at the current tick. Advances tick by duration.
   * Applies transpose; uses default velocity when omitted. Emits a thunk that
   * calls `insertNote` on commit.
   *
   * @param pitch - MIDI pitch (0–127), before transpose
   * @param duration - Note duration in ticks. Default: defaultDuration
   * @param velocity - Override velocity (0–127). Default: this.velocity
   * @returns New bridge with tick advanced and note thunk appended
   */
  withNote(pitch: number, duration?: number, velocity?: number): BaseCompositionBridge {
    const dur = duration ?? this.params.defaultDuration
    const vel = velocity ?? this.params.velocity
    const finalPitch = pitch + this.params.transpose
    const tick = this.params.tick
    const muted = this.params.muted

    return this.derive({ tick: this.params.tick + dur }, ctx => {
      return ctx.insertNote(finalPitch, vel, dur, tick, muted, 0)
    })
  }

  /**
   * Defer a MIDI CC event at the current tick.
   *
   * @param controller - MIDI CC number (0–127)
   * @param value - CC value (0–127)
   * @returns New bridge with CC thunk appended
   */
  withCC(controller: number, value: number): BaseCompositionBridge {
    const tick = this.params.tick

    return this.derive({}, ctx => ctx.insertCC(controller, value, tick, 0))
  }

  /**
   * Defer a pitch bend event at the current tick.
   *
   * @param value - Pitch bend value (14-bit: 0 = full down, 8192 = center, 16383 = full up)
   * @returns New bridge with bend thunk appended
   */
  withBend(value: number): BaseCompositionBridge {
    const tick = this.params.tick

    return this.derive({}, ctx => ctx.insertBend(value, tick, 0))
  }

  /**
   * Defer aftertouch at the current tick. Channel aftertouch when pitch omitted;
   * poly aftertouch when pitch provided.
   *
   * @param value - Aftertouch value (0–127)
   * @param pitch - Optional MIDI pitch for poly aftertouch; omit for channel aftertouch
   * @returns New bridge with aftertouch thunk appended
   */
  withAftertouch(value: number, pitch?: number): BaseCompositionBridge {
    const tick = this.params.tick

    if (pitch !== undefined) {
      // Poly aftertouch — per-note pressure
      return this.derive({}, ctx => ctx.insertCC(0xA0, value, tick, pitch))
    }
    // Channel aftertouch
    return this.derive({}, ctx => ctx.insertCC(0xD0, value, tick, 0))
  }

  /**
   * Defer a synapse connection between nodes.
   *
   * @param srcId - Source node id
   * @param tgtId - Target node id
   * @param weight - Optional connection weight
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
   * @returns New bridge with disconnect thunk appended
   */
  withDisconnect(srcId: number, tgtId: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.disconnect(srcId, tgtId))
  }

  /**
   * Defer node reclamation.
   *
   * @param nodePtr - Node pointer to reclaim
   * @returns New bridge with reclaim thunk appended
   */
  withReclaim(nodePtr: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.reclaim(nodePtr))
  }

  /**
   * Return a new bridge with the given velocity. Affects subsequent withNote calls.
   *
   * @param v - Velocity (0–127)
   * @returns New bridge with updated velocity
   */
  withVelocity(v: number): BaseCompositionBridge {
    return this.derive({ velocity: v })
  }

  /**
   * Return a new bridge with the given transpose offset in semitones.
   *
   * @param s - Transpose in semitones
   * @returns New bridge with updated transpose
   */
  withTranspose(s: number): BaseCompositionBridge {
    return this.derive({ transpose: s })
  }

  /**
   * Return a new bridge with the given default duration in ticks.
   *
   * @param d - Default duration in ticks
   * @returns New bridge with updated defaultDuration
   */
  withDefaultDuration(d: number): BaseCompositionBridge {
    return this.derive({ defaultDuration: d })
  }

  /**
   * Return a new bridge with the given tempo.
   *
   * @param bpm - Tempo in BPM
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
   * @returns New bridge with updated time signature
   */
  withTimeSignature(num: number, den: number): BaseCompositionBridge {
    return this.derive({ timeSignatureNum: num, timeSignatureDen: den })
  }

  /**
   * Return a new bridge with the given scale context.
   *
   * @param root - Scale root pitch class (0–11)
   * @param mode - Scale mode
   * @returns New bridge with updated scale
   */
  withScale(root: PitchClass, mode: ScaleMode): BaseCompositionBridge {
    return this.derive({ scaleRoot: root, scaleMode: mode })
  }

  /**
   * Return a new bridge with the given key context.
   *
   * @param root - Key root pitch class (0–11)
   * @param mode - Key mode
   * @returns New bridge with updated key
   */
  withKey(root: PitchClass, mode: ScaleMode): BaseCompositionBridge {
    return this.derive({ keyRoot: root, keyMode: mode })
  }

  /**
   * Return a new bridge with the given volume. Emits CC7 at current tick and tracks state.
   *
   * @param v - Volume (0–127)
   * @returns New bridge with volume CC thunk appended
   */
  withVolume(v: number): BaseCompositionBridge {
    const tick = this.params.tick
    return this.derive({ volume: v }, ctx => ctx.insertCC(MIDI_CC.VOLUME, v, tick, 0))
  }

  /**
   * Return a new bridge with the given pan. Emits CC10 at current tick and tracks state.
   *
   * @param v - Pan (0–127, 64 = center)
   * @returns New bridge with pan CC thunk appended
   */
  withPan(v: number): BaseCompositionBridge {
    const tick = this.params.tick
    return this.derive({ pan: v }, ctx => ctx.insertCC(MIDI_CC.PAN, v, tick, 0))
  }

  /**
   * Return a new bridge with the given swing amount.
   *
   * @param amount - Swing amount (0.0–1.0)
   * @returns New bridge with updated swing
   */
  withSwing(amount: number): BaseCompositionBridge {
    return this.derive({ swing: amount })
  }

  /**
   * Return a new bridge with quantize settings.
   *
   * @param grid - Quantize grid in ticks; 0 disables quantize
   * @param strength - Quantize strength (0–1). Default: 1.0
   * @returns New bridge with updated quantize settings
   */
  withQuantize(grid: number, strength?: number): BaseCompositionBridge {
    return this.derive({ quantizeGrid: grid, quantizeStrength: strength ?? 1.0 })
  }

  /**
   * Return a new bridge with the given tick position.
   *
   * @param tick - Tick position in ticks (PPQ 480)
   * @returns New bridge with updated tick
   */
  withTick(tick: number): BaseCompositionBridge {
    return this.derive({ tick })
  }

  /**
   * Return a new bridge with the muted flag.
   *
   * @param muted - Whether notes are muted
   * @returns New bridge with updated muted state
   */
  withMuted(muted: boolean): BaseCompositionBridge {
    return this.derive({ muted })
  }

  /**
   * Return a new bridge with the precise flag. When true, skips humanization.
   *
   * @param precise - Whether to skip humanization
   * @returns New bridge with updated precise state
   */
  withPrecise(precise: boolean): BaseCompositionBridge {
    return this.derive({ precise })
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
