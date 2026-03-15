import { IsolateBuilder } from '../builders/IsolateBuilder'

/**
 * Create an isolated scope — state changes inside don't leak out.
 *
 * Usage:
 *   isolate().steps(
 *     tempo(140),
 *     velocity(80),
 *     note('C4'), note('D4')
 *   )
 *   // After: tempo, velocity, etc. are restored to parent values
 */
export function isolate(): IsolateBuilder {
  return new IsolateBuilder()
}
