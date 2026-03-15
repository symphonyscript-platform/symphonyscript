import { CompositionBridge } from '@symphonyscript/composer'
import type { HarmonyMask, VoiceLeadingStyle } from '@symphonyscript/theory'
import { closeVoicing, drop2Voicing, getScaleIntervals, openVoicing } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { KNUTH_MULTIPLIER } from '../constants'

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

  mask(mask: HarmonyMask): HarmonyBuilder {
    return this.cloneHarmony({ mask })
  }

  root(root: number): HarmonyBuilder {
    return this.cloneHarmony({ root })
  }

  drop2(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'drop2' })
  }

  open(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'open' })
  }

  close(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'close' })
  }

  strum(rate: number, direction: 'up' | 'down' = 'up'): HarmonyBuilder {
    return this.cloneHarmony({ strumRate: rate, strumDirection: direction })
  }

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

    const pitches = this.resolvePitches(resolvedRoot)
    if (pitches.length === 0) return this.resetFlags(target)

    for (let repeat = 0; repeat < this.shared.repeatCount; ++repeat) {
      const repeatStartTick = target.tick

      if (this.strumRate !== null && this.strumRate > 0) {
        target = this.emitStrum(target, pitches, repeatStartTick, scaledDuration)
      } else {
        target = this.emitSimultaneous(target, pitches, repeatStartTick, scaledDuration)
      }

      const advanceDuration = scaledDuration ?? bridge.defaultDuration
      target = target.withTick(repeatStartTick + advanceDuration)
    }

    return this.resetFlags(target)
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

  /** Resolve pitches from mask using the appropriate voicing function or raw intervals. */
  private resolvePitches(resolvedRoot: number): number[] {
    if (this.voicingStyle !== null) {
      const voicingFn = this.voicingStyle === 'drop2' ? drop2Voicing
        : this.voicingStyle === 'open' ? openVoicing
        : closeVoicing

      const rawPitches = voicingFn(this._mask, 4, 4)
      const pitches = new Array<number>(rawPitches.length)

      for (let i = 0; i < rawPitches.length; ++i) {
        pitches[i] = rawPitches[i] + resolvedRoot
      }

      return pitches
    }

    const intervals = getScaleIntervals(this._mask)
    const pitches = new Array<number>(intervals.length)

    for (let i = 0; i < intervals.length; ++i) {
      pitches[i] = resolvedRoot + Math.floor(Number(intervals[i]) / 2)
    }

    return pitches
  }

  /** Emit chord notes with strum offset. */
  private emitStrum(
    bridge: CompositionBridge,
    pitches: number[],
    startTick: number,
    duration: number | undefined,
  ): CompositionBridge {
    let target = bridge

    // Reverse pitches for down strum
    const ordered = this.strumDirection === 'down'
      ? this.reverseArray(pitches)
      : pitches

    for (let i = 0; i < ordered.length; ++i) {
      const strumOffset = i * this.strumRate!
      target = target
        .withTick(startTick + strumOffset)
        .withNote(ordered[i], duration, this.shared.velocity ?? undefined)
    }

    return target
  }

  /** Emit chord notes simultaneously with optional spread. */
  private emitSimultaneous(
    bridge: CompositionBridge,
    pitches: number[],
    startTick: number,
    duration: number | undefined,
  ): CompositionBridge {
    let target = bridge
    let seedValue = this.spreadSeed ?? (startTick * KNUTH_MULTIPLIER) | 0

    for (let i = 0; i < pitches.length; ++i) {
      let spreadOffset = 0

      if (this.spreadAmount > 0) {
        seedValue = (seedValue * 1664525 + 1013904223) & 0x7fffffff
        spreadOffset = (seedValue & 0xffff) % (this.spreadAmount + 1)
      }

      target = target
        .withTick(startTick + spreadOffset)
        .withNote(pitches[i], duration, this.shared.velocity ?? undefined)
    }

    return target
  }

  /** Imperative array reverse. */
  private reverseArray(source: number[]): number[] {
    const result = new Array<number>(source.length)
    const last = source.length - 1

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[last - i]
    }

    return result
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
}
