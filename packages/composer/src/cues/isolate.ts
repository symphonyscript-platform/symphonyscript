import { IsolateBuilder } from '../builders/IsolateBuilder'

/**
 * Create an isolated scope — state changes inside do not leak out.
 *
 * Inner steps inherit parent context (tempo, velocity, transpose, etc.) but
 * modifications are discarded on exit. Tick and emitted notes propagate;
 * only bridge state fields are restored. See {@link IsolateBuilder}.
 *
 * @returns Immutable {@link IsolateBuilder} — chain `.steps()` to add content.
 *
 * @example
 * ```ts
 * isolate().steps(note('C4'), note('D4'))                    // Pass-through, no state changes
 * isolate().steps(tempo(140), note('C4'))                    // Tempo restored after exit
 * isolate().steps(velocity(400), transpose(12), note('C4')) // velocity + transpose isolated
 * pipe(note('E4'), isolate().steps(note('C4'), note('G4')), note('E4'))  // Nested melody
 * ```
 */
export function isolate(): IsolateBuilder {
  return new IsolateBuilder()
}
