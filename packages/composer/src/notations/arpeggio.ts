import { ArpeggioBuilder } from '../builders/ArpeggioBuilder'
import type { NotePitch } from '../types'

/**
 * Create an {@link ArpeggioBuilder} that emits chord or note sequences in sequence.
 *
 * Pitches are resolved via {@link resolvePitches} at apply-time, expanded across
 * octaves, and ordered by pattern (`up`, `down`, `upDown`, etc.). Each note is
 * emitted sequentially with per-step timing. Chain `.pattern()`, `.octaves()`,
 * `.gate()`, `.velocity()`, and `.seed()` to configure behaviour.
 *
 * Called without arguments, creates an empty builder that returns the bridge
 * unchanged on apply. Pitches may be provided later via `.pitches()`.
 *
 * @param pitches - Literal note names (e.g. `'C4'`, `'E4'`) or MIDI numbers. Resolved via {@link resolvePitches}.
 * @param rate - Tick duration per arpeggio step. `undefined` = bridge default at apply-time.

 * @returns Immutable {@link ArpeggioBuilder} — chain `.pattern()`, `.octaves()`, `.gate()`, etc.
 * @throws If any pitch string cannot be parsed (e.g. `'invalid'`) — thrown during `apply()`
 *
 * @example
 * ```ts
 * arpeggio(['C4', 'E4', 'G4'])                    // Up pattern, bridge default rate
 * arpeggio(['C4', 'E4', 'G4'], 120).pattern('down')
 * arpeggio(['C4', 'E4'], 60).pattern('upDown')    // Up-down cycle
 * arpeggio(['C4', 'E4', 'G4']).octaves(2).gate(0.8)
 * arpeggio([60, 64, 67]).pattern('random').seed(42)
 * ```
 */
export function arpeggio(pitches?: NotePitch[], rate?: number): ArpeggioBuilder {
  return new ArpeggioBuilder({ pitches, rate })
}
