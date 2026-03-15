import { CompositionBridge } from '@symphonyscript/composer'
import { getScaleIntervals, closeVoicing, openVoicing, drop2Voicing } from '@symphonyscript/theory'
import type { HarmonyMask, VoiceLeadingStyle } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

export interface HarmonyParams extends PitchStepParams {
  mask: HarmonyMask
  root: number
  voicing: VoiceLeadingStyle | null
  strumRate: number | null
  strumDirection: 'up' | 'down'
  spread: number
  spreadSeed: number | null
}

export class HarmonyBuilder extends PitchStepBuilder<HarmonyBuilder> {
  private readonly _mask: HarmonyMask
  private readonly _root: number
  private readonly voicingStyle: VoiceLeadingStyle | null
  private readonly strumRate: number | null
  private readonly strumDirection: 'up' | 'down'
  private readonly spreadAmount: number
  private readonly spreadSeed: number | null

  constructor(params: Partial<HarmonyParams>) {
    super(params)
    this._mask = params.mask ?? (0 as HarmonyMask)
    this._root = params.root ?? 60
    this.voicingStyle = params.voicing ?? null
    this.strumRate = params.strumRate ?? null
    this.strumDirection = params.strumDirection ?? 'up'
    this.spreadAmount = params.spread ?? 0
    this.spreadSeed = params.spreadSeed ?? null
  }

  protected create(params: Partial<PitchStepParams>): HarmonyBuilder {
    return new HarmonyBuilder({
      ...params,
      mask: this._mask,
      root: this._root,
      voicing: this.voicingStyle,
      strumRate: this.strumRate,
      strumDirection: this.strumDirection,
      spread: this.spreadAmount,
      spreadSeed: this.spreadSeed,
    })
  }

  private cloneHarmony(overrides: Partial<HarmonyParams>): HarmonyBuilder {
    return new HarmonyBuilder({
      ...this.shared,
      mask: overrides.mask ?? this._mask,
      root: overrides.root ?? this._root,
      voicing: overrides.voicing !== undefined ? overrides.voicing : this.voicingStyle,
      strumRate: overrides.strumRate !== undefined ? overrides.strumRate : this.strumRate,
      strumDirection: overrides.strumDirection ?? this.strumDirection,
      spread: overrides.spread !== undefined ? overrides.spread : this.spreadAmount,
      spreadSeed: overrides.spreadSeed !== undefined ? overrides.spreadSeed : this.spreadSeed,
    })
  }

  mask(mask: HarmonyMask): HarmonyBuilder {
    return this.cloneHarmony({ mask })
  }

  root(root: number): HarmonyBuilder {
    return this.cloneHarmony({ root })
  }

  /** Drop-2 voicing — drop second-highest note by an octave. */
  drop2(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'drop2' })
  }

  /** Open voicing — spread every other voice up an octave. */
  open(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'open' })
  }

  /** Close voicing — keep all voices within one octave. */
  close(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'close' })
  }

  /** Strum — arpeggiate chord notes with a small delay between each. */
  strum(rate: number, direction: 'up' | 'down' = 'up'): HarmonyBuilder {
    return this.cloneHarmony({ strumRate: rate, strumDirection: direction })
  }

  /** Spread — add timing offset to each note (humanize chord). */
  spread(amount: number, seed?: number): HarmonyBuilder {
    return this.cloneHarmony({ spread: amount, spreadSeed: seed ?? null })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    let target = this.applyFlags(bridge)
    const scaledDuration = this.resolvedDuration()
    const resolvedRoot = this._root
      + this.shared.accidental
      + (this.shared.octaveShift * 12)
      + this.shared.transposeSemitones

    // If a voicing style is set, use theory voicing functions
    let pitches: number[]
    if (this.voicingStyle !== null) {
      const voicingFn = this.voicingStyle === 'drop2' ? drop2Voicing
        : this.voicingStyle === 'open' ? openVoicing
        : closeVoicing

      // Voicing functions work with mask + octave
      const rawPitches = voicingFn(this._mask, 4, 4)
      // Shift to root
      pitches = new Array(rawPitches.length)
      for (let i = 0; i < rawPitches.length; ++i) {
        pitches[i] = rawPitches[i] + resolvedRoot
      }
    } else {
      // Default: extract intervals from mask
      const intervals = getScaleIntervals(this._mask)
      pitches = new Array(intervals.length)
      for (let i = 0; i < intervals.length; ++i) {
        pitches[i] = resolvedRoot + Math.floor(Number(intervals[i]) / 2)
      }
    }

    if (pitches.length === 0) return this.resetFlags(target)

    for (let repeat = 0; repeat < this.shared.repeatCount; ++repeat) {
      const repeatStartTick = target.tick

      if (this.strumRate !== null && this.strumRate > 0) {
        // Strum mode: offset each note slightly
        const strumPitches = this.strumDirection === 'down'
          ? pitches.slice().reverse()
          : pitches

        for (let i = 0; i < strumPitches.length; ++i) {
          const strumOffset = i * this.strumRate
          target = target
            .withTick(repeatStartTick + strumOffset)
            .withNote(strumPitches[i], scaledDuration, this.shared.velocity ?? undefined)
        }
      } else {
        // Simultaneous chord
        let seedValue = this.spreadSeed ?? Date.now()
        for (let i = 0; i < pitches.length; ++i) {
          let spreadOffset = 0
          if (this.spreadAmount > 0) {
            seedValue = (seedValue * 1664525 + 1013904223) & 0x7fffffff
            spreadOffset = (seedValue & 0xffff) % (this.spreadAmount + 1)
          }

          target = target
            .withTick(repeatStartTick + spreadOffset)
            .withNote(pitches[i], scaledDuration, this.shared.velocity ?? undefined)
        }
      }

      const advanceDuration = scaledDuration ?? bridge.defaultDuration
      target = target.withTick(repeatStartTick + advanceDuration)
    }

    return this.resetFlags(target)
  }
}
