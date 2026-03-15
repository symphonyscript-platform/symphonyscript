import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

/**
 * Full context isolation — nothing leaks out.
 *
 * Inner steps see the parent's context, but changes made inside
 * (tempo, velocity, transpose, scale, etc.) don't propagate
 * to subsequent steps after the scope exits.
 *
 * Tick and thunks (emitted notes) DO propagate — only the state fields are restored.
 *
 * Usage:
 *   isolate().steps(tempo(140), note('C4'), note('D4'))
 *   // After: tempo is back to whatever the parent had
 */
export class IsolateBuilder implements ScopeBuilder<IsolateBuilder> {
  private readonly entries: PipeStep[][]

  constructor(entries: PipeStep[][] = []) {
    this.entries = entries
  }

  /** Add steps to this isolation scope (accumulates). */
  steps(...pipeSteps: PipeStep[]): IsolateBuilder {
    return new IsolateBuilder(appendSteps(this.entries, pipeSteps))
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.entries.length === 0) {
      return bridge
    }

    const result = applyEntries(this.entries, bridge)

    // Restore ALL state fields from parent, keep tick (and thunks)
    let restored = result
      .withVelocity(bridge.velocity)
      .withTranspose(bridge.transpose)
      .withDefaultDuration(bridge.defaultDuration)
      .withTempo(bridge.tempo)
      .withTimeSignature(bridge.timeSignatureNum, bridge.timeSignatureDen)
      .withScale(bridge.scaleRoot, bridge.scaleMode)
      .withVolume(bridge.volume)
      .withPan(bridge.pan)
      .withSwing(bridge.swing)
      .withPrecise(bridge.precise)
      .withQuantize(bridge.quantizeGrid, bridge.quantizeStrength)
      .withMuted(bridge.muted)

    // Restore key context only if parent had one
    if (bridge.keyRoot !== null) {
      restored = restored.withKey(bridge.keyRoot, bridge.keyMode)
    }

    return restored
  }
}
