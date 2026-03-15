import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { RomanNumeral } from '@symphonyscript/theory'
import { degreeToPitch, ROMAN_DEGREE_MAP } from '@symphonyscript/theory'

export interface VoiceLeadParams {
  numerals: RomanNumeral[]
  duration: number | null
}

/**
 * Voice-led chord progression from roman numerals.
 * Minimizes voice movement between consecutive chords by choosing
 * the closest octave placement for each voice.
 *
 * Usage:
 *   voiceLead(['I', 'IV', 'V', 'I'])
 *   voiceLead(['I', 'vi', 'IV', 'V']).duration(480)
 */
export class VoiceLeadBuilder implements PipeStep {
  private readonly params: VoiceLeadParams

  constructor(params: Partial<VoiceLeadParams> = {}) {
    this.params = {
      numerals: params.numerals ?? [],
      duration: params.duration ?? null,
    }
  }

  numerals(numerals: RomanNumeral[]): VoiceLeadBuilder {
    return this.clone({ numerals })
  }

  duration(duration: number): VoiceLeadBuilder {
    return this.clone({ duration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    let target = bridge
    let prevPitches: number[] | null = null

    for (let i = 0; i < this.params.numerals.length; ++i) {
      const degrees = ROMAN_DEGREE_MAP[this.params.numerals[i]]
      const rawPitches: number[] = []

      for (let j = 0; j < degrees.length; ++j) {
        const resolvedPitch = degreeToPitch(
          degrees[j],
          target.scaleRoot,
          target.scaleMode,
        )

        if (resolvedPitch !== null) {
          rawPitches.push(resolvedPitch)
        }
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
   * Uses closest octave placement for each voice.
   */
  private voiceLeadPitches(rawPitches: number[], prev: number[]): number[] {
    const result: number[] = []

    for (let i = 0; i < rawPitches.length; ++i) {
      const targetPitch = rawPitches[i]
      const anchor = i < prev.length ? prev[i] : prev[prev.length - 1]

      let best = targetPitch
      let bestDist = Math.abs(targetPitch - anchor)

      for (let octave = -2; octave <= 2; ++octave) {
        const candidate = targetPitch + octave * 12
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

  private clone(overrides: Partial<VoiceLeadParams>): VoiceLeadBuilder {
    return new VoiceLeadBuilder({ ...this.params, ...overrides })
  }
}
