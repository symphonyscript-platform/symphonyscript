import type { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { appendSteps, applyEntries } from '../utils/scope-entries'
import { ScopeBuilder } from '../interfaces/scope-builder'

/**
 * Runs steps in an isolated scope; state changes inside do not leak to outer composition.
 *
 * Inner steps inherit the parent's context (tempo, velocity, transpose, scale, etc.)
 * but any modifications made within the scope are discarded when the scope exits.
 * Tick advances and emitted notes (thunks) propagate; only bridge state fields are restored.
 * Use for nested compositions that must not affect the outer tick or state.
 *
 * Implements {@link ScopeBuilder}. Uses clone-on-set immutability.
 *
 * @example
 * ```ts
 * isolate().steps(note('C4'), note('D4'))                    // pass-through, no state changes
 * isolate().steps(tempo(140), note('C4'))                    // tempo restored after exit
 * isolate().steps(velocity(400), transpose(12), note('C4'))  // velocity + transpose isolated
 * isolate().steps(volume(30), note('C4'))                   // volume restore emits CC
 * pipe(note('E4'), isolate().steps(note('C4'), note('G4')), note('E4'))  // nested melody
 * ```
 */
export class IsolateBuilder implements ScopeBuilder<IsolateBuilder> {
  /** Ordered groups of {@link PipeStep}s to run within the isolated scope. */
  private readonly entries: PipeStep[][]

  /** @internal */
  constructor(entries: PipeStep[][] = []) {
    this.entries = entries
  }

  /**
   * Append steps to this isolation scope.
   *
   * @param pipeSteps - One or more {@link PipeStep}s to run within the isolated scope
   *
   * @returns New IsolateBuilder with the appended steps
   */
  steps(...pipeSteps: PipeStep[]): IsolateBuilder {
    return new IsolateBuilder(appendSteps(this.entries, pipeSteps))
  }

  /**
   * Run the contained steps, then restore all parent state fields.
   *
   * **Isolation semantics:**
   * - Inner steps start with the parent's bridge context.
   * - Changes inside the scope do **not** propagate out.
   * - Tick and thunks **do** propagate; only state fields are restored.
   *
   * @param bridge - Current composition state
   *
   * @returns Bridge with inner steps applied, parent state restored, tick and thunks preserved
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.entries.length === 0) {
      return bridge
    }

    const result = applyEntries(this.entries, bridge)

    // Restore ALL state fields from parent, keep tick (and thunks)
    let restored = result
      .withVelocity(bridge.velocity)
      .withTransposeCents(bridge.transposeCents)
      .withDefaultDuration(bridge.defaultDuration)
      .withTempo(bridge.tempo)
      .withTimeSignature(bridge.timeSignatureNum, bridge.timeSignatureDen)
      .withScaleRootCents(bridge.scaleRootCents)
      .withVolume(bridge.volume)
      .withPan(bridge.pan)
      .withSwing(bridge.swing)
      .withPrecise(bridge.precise)
      .withQuantize(bridge.quantizeGrid, bridge.quantizeStrength)
      .withMuted(bridge.muted)

    // Restore scale intervals
    if (bridge.scaleIntervals !== null) {
      restored = restored.withScaleIntervals(bridge.scaleIntervals)
    }

    // Restore key context
    if (bridge.keyRootCents !== null) {
      restored = restored.withKeyRootCents(bridge.keyRootCents)
    }

    return restored
  }
}
