import type { Degree } from '@symphonyscript/core'
import { VoiceLeadBuilder } from '../builders/VoiceLeadBuilder'

/**
 * Create a {@link VoiceLeadBuilder} that emits a voice-led chord progression from roman numerals.
 *
 * Unlike {@link progression}, minimizes voice movement between consecutive chords by
 * choosing the closest octave placement for each voice (within ±2 octaves). Resolves
 * numerals via `bridge.notation().resolveProgression()`, then rearranges octave placements
 * so each voice stays as close as possible to the previous chord. The first chord uses
 * default placement; subsequent chords optimize relative to the prior.
 *
 * @param numerals - Ordered degree numerals (e.g. `['I', 'IV', 'V', 'I']`).
 * @param duration - Per-chord duration in beats. `undefined` = bridge default.
 *
 * @returns Immutable {@link VoiceLeadBuilder}
 *
 * @example
 * ```ts
 * voiceLead(['I', 'IV', 'V', 'I'])             // I–IV–V–I with minimal voice movement
 * voiceLead(['I', 'vi', 'IV', 'V']).duration(480)
 * voiceLead(['ii', 'V7', 'I'])                 // ii–V7–I with smooth voice leading
 * voiceLead([]).apply(bridge)                  // No-op (unchanged bridge)
 * ```
 */
export function voiceLead(numerals: Degree[], duration?: number): VoiceLeadBuilder {
  return new VoiceLeadBuilder({ numerals, duration })
}
