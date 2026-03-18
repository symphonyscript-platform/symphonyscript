import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { Degree } from '@symphonyscript/core'

/**
 * Parameters for {@link VoiceLeadBuilder}.
 *
 * Same structure as {@link ProgressionParams}, but emission uses voice-leading logic.
 */
export interface VoiceLeadParams {
  /** Ordered roman numerals (e.g. I–IV–V–I). */
  numerals: Degree[]
  /** Per-chord duration in ticks. `null` = use bridge default. */
  duration: number | null
}

/**
 * Immutable builder that emits a voice-led chord progression from roman numerals.
 *
 * Minimizes voice movement between consecutive chords by choosing the closest
 * octave placement for each voice (within ±2 octaves). Resolves numerals via
 * `bridge.notation().resolveProgression()`, then applies `voiceLeadPitches` to
 * each chord relative to the previous chord's pitches.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * voiceLead(['I', 'IV', 'V', 'I'])             // I–IV–V–I with minimal voice movement
 * voiceLead(['I', 'vi', 'IV', 'V']).duration(480)
 * voiceLead(['ii', 'V7', 'I'])                 // ii–V7–I with smooth voice leading
 * voiceLead([]).apply(bridge)                  // No-op (unchanged bridge)
 * ```
 */
export class VoiceLeadBuilder implements PipeStep {
  private readonly params: VoiceLeadParams

  constructor(params: Partial<VoiceLeadParams> = {}) {
    this.params = {
      numerals: params.numerals ?? [],
      duration: params.duration ?? null,
    }
  }

  /**
   * Set the chord progression (ordered roman numerals).
   *
   * @param numerals - Array of roman numerals (e.g. ['I', 'IV', 'V', 'I'])
   *
   * @returns New VoiceLeadBuilder with the updated numerals
   */
  numerals(numerals: Degree[]): VoiceLeadBuilder {
    return this.clone({ numerals })
  }

  /**
   * Set per-chord duration in ticks.
   *
   * @param duration - Duration in ticks
   *
   * @returns New VoiceLeadBuilder with the updated duration
   */
  duration(duration: number): VoiceLeadBuilder {
    return this.clone({ duration })
  }

  /**
   * Emit each chord with voice-leading: minimizes total pitch movement from the previous chord.
   *
   * Resolves all numerals via `bridge.notation().resolveProgression()` to get
   * `{ rootCents, intervals }` per chord. For each chord, computes absolute pitches
   * then rearranges octave placements so each voice stays as close as possible to
   * the previous chord. The first chord uses default placement.
   *
   * @param bridge - Current composition state
   *
   * @returns Updated bridge with voice-led progression emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    const scale = bridge.scaleIntervals
    if (scale === null) return bridge
    if (this.params.numerals.length === 0) return bridge

    const resolutions = bridge.notation().resolveProgression(
      this.params.numerals,
      scale as number[],
    )

    let target = bridge
    let prevPitches: number[] | null = null

    for (let i = 0; i < resolutions.length; ++i) {
      const { rootCents, intervals } = resolutions[i]
      const chordRoot = target.scaleRootCents + rootCents

      // Build absolute pitches from root + intervals
      const rawPitches: number[] = []
      for (let j = 0; j < intervals.length; ++j) {
        rawPitches.push(chordRoot + intervals[j])
      }

      const pitches: number[] = prevPitches
        ? this.voiceLeadPitches(rawPitches, prevPitches)
        : rawPitches

      const chordDuration = this.params.duration ?? target.defaultDuration
      const chordTick = target.tick

      for (let k = 0; k < pitches.length; ++k) {
        target = target
          .withTick(chordTick)
          .withNote(pitches[k], chordDuration)
      }

      target = target.withTick(chordTick + chordDuration)
      prevPitches = pitches
    }

    return target
  }

  /**
   * Rearrange pitches to minimize total movement from previous chord.
   *
   * For each voice, tests ±2 octave offsets (±2400 cents) and picks the
   * placement with smallest distance to the corresponding previous voice.
   */
  private voiceLeadPitches(rawPitches: number[], prev: number[]): number[] {
    const result: number[] = []

    for (let i = 0; i < rawPitches.length; ++i) {
      const targetPitch = rawPitches[i]
      const anchor = i < prev.length ? prev[i] : prev[prev.length - 1]

      let best = targetPitch
      let bestDist = Math.abs(targetPitch - anchor)

      for (let octave = -2; octave <= 2; ++octave) {
        const candidate = targetPitch + octave * 1200
        const dist = Math.abs(candidate - anchor)

        if (dist < bestDist) {
          best = candidate
          bestDist = dist
        }
      }

      result.push(best)
    }

    return result
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<VoiceLeadParams>): VoiceLeadBuilder {
    return new VoiceLeadBuilder({ ...this.params, ...overrides })
  }
}
