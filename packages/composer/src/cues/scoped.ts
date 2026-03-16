import type { PipeStep } from '@symphonyscript/composer'
import { ScopedBuilder } from '../builders/ScopedBuilder'

/**
 * Compose multiple effects into one scoped block.
 *
 * Partitions effects into interceptors (bridge wrappers) and transforms (post-processors).
 * When steps are provided via `.steps()`, interceptors wrap first, entries run through
 * the wrapped bridge, then transforms post-process. With no steps, effects cascade
 * as defaults downstream. See {@link ScopedBuilder}.
 *
 * @param effects - Interceptors and transforms to apply (e.g. humanize, swing, reverse,
 *   sustain). Order matters: first wraps innermost, last wraps outermost.
 * @returns Immutable {@link ScopedBuilder} — chain `.steps()` to add content.
 *
 * @example
 * ```ts
 * scoped(humanize(20, 10), swing(0.6)).steps(note('C4'), note('D4'))
 * scoped(humanize(20, 10), reverse()).steps(use(melodyClip))
 * scoped(sustain()).steps(note('C4'), note('E4'))  // sustain applies to notes only
 * scoped(sustain())                                // No steps → sustain cascades downstream
 * scoped()                                         // No effects, no steps → pass-through
 * ```
 */
export function scoped(...effects: PipeStep[]): ScopedBuilder {
  return new ScopedBuilder({ effects })
}
