import { CompositionBridge } from '@symphonyscript/composer'
import { MIDI_CC } from '@symphonyscript/theory'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

/**
 * Bridge decorator that enables portamento (glide) between consecutive notes.
 *
 * On the first note, sends CC 65 (PORTAMENTO) with value 127 to the inner bridge,
 * then emits the note. Subsequent notes are emitted with portamento already active,
 * so the synthesizer glides from the previous pitch to each new pitch instead of
 * stepping. Call {@link flush} when the glide group ends to disable portamento
 * (CC 65 = 0).
 *
 * Uses MIDI standard portamento control; glide time is typically set separately
 * (e.g. via CC 5 or a synth-specific control).
 *
 * Extends {@link CompositionBridgeDecorator}. Immutable.
 *
 * @example
 * ```ts
 * glide().steps(note('C4'), note('E4'), note('G4'))
 * // CC 127 before C4; E4 and G4 glide from previous pitch; flush() sends CC 0
 * ```
 */
export class GlideBridge extends CompositionBridgeDecorator {
  /** Whether portamento is active (CC 65 = 127 sent). */
  private readonly activated: boolean

  /**
   * @param bridge - Inner bridge to delegate to
   * @param activated - True if portamento CC has already been sent
   */
  constructor(bridge: CompositionBridge, activated: boolean = false) {
    super(bridge)
    this.activated = activated
  }

  /**
   * Emit note with portamento. First note: send CC 65 = 127, then emit. Subsequent:
   * emit only (portamento already on). All notes glide to the next.
   *
   * @param pitch - MIDI pitch number
   * @param duration - Note duration in ticks; defaults to `defaultDuration`
   * @param velocity - Optional velocity override

   * @returns New bridge state with `activated` true
   */
  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (!this.activated) {
      // First note — enable portamento, then emit
      const bridgeWithPortamento = this.bridge.withCC(MIDI_CC.PORTAMENTO, 127)
      return new GlideBridge(bridgeWithPortamento.withNote(pitch, duration, velocity), true)
    }

    // Subsequent notes — portamento already active, just emit
    return new GlideBridge(this.bridge.withNote(pitch, duration, velocity), true)
  }

  /**
   * Disable portamento by sending CC 65 = 0. Call when the glide phrase ends
   * so the next non-glide material does not inherit portamento.
   *
   * No-op if portamento was never activated.
   *
   * @returns Inner bridge with portamento CC 0 sent (or unchanged if not active)
   */
  flush(): CompositionBridge {
    if (this.activated) {
      return this.bridge.withCC(MIDI_CC.PORTAMENTO, 0)
    }

    return this.bridge
  }

  /** @internal Preserves activated state when re-wrapping. */
  protected rewrap(bridge: CompositionBridge): GlideBridge {
    return new GlideBridge(bridge, this.activated)
  }
}
