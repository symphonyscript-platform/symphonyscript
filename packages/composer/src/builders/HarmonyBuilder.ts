import { CompositionBridge } from '@symphonyscript/composer'
import type { ChordCode, ChordIntervals, ChordSymbol, NoteName, NotePitch } from '@symphonyscript/core'
import type { VoiceLeadingStyle } from '@symphonyscript/theory'
import { closeVoicing, drop2Voicing, openVoicing } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { KNUTH_MULTIPLIER } from '../constants'

export type { ChordIntervals } from '@symphonyscript/core'

/**
 * Parameters specific to {@link HarmonyBuilder}.
 *
 * Extends {@link PitchStepParams} with chord voicing, strum, and spread fields.
 */
export interface HarmonyParams extends PitchStepParams {
  /** Chord intervals in cents from root (e.g. [0, 400, 700]). */
  intervals: ChordIntervals
  /**
   * Chord symbol for deferred resolution via notation (e.g. 'Cmaj7').
   * When set, intervals are resolved at apply-time via bridge.notation().
   */
  symbol: ChordCode | null
  /** Root pitch as string note name or absolute cents from C0. Defaults to 6000 (C4). */
  root: NotePitch
  /** Voicing algorithm. null = raw intervals. */
  voicing: VoiceLeadingStyle | null
  /** Tick delay between each strummed note. null = simultaneous emission. */
  strumRate: number | null
  /** Strum direction. Only applies when strumRate is set. */
  strumDirection: 'up' | 'down'
  /** Maximum random tick offset per note for humanized timing. 0 = no spread. */
  spread: number
  /** Seed for deterministic spread randomization. null = tick-derived. */
  spreadSeed: number | null
}

/**
 * Immutable builder for chord/harmony emission.
 *
 * Emits multiple simultaneous notes from chord intervals (cents).
 * Supports three voicing algorithms (close, open, drop2), strumming,
 * and randomized spread for humanized timing.
 *
 * Chord intervals can be:
 * - Provided directly as a number[] (e.g. [0, 400, 700])
 * - Resolved at apply-time from a chord symbol via bridge.notation()
 *
 * All builder methods return new instances (clone-on-set immutability).
 */
export class HarmonyBuilder extends PitchStepBuilder<HarmonyBuilder> {
  private readonly _intervals: ChordIntervals
  private readonly _symbol: ChordCode | null
  private readonly _root: NotePitch
  private readonly voicingStyle: VoiceLeadingStyle | null
  private readonly strumRate: number | null
  private readonly strumDirection: 'up' | 'down'
  private readonly spreadAmount: number
  private readonly spreadSeed: number | null

  constructor(params: Partial<HarmonyParams>) {
    super(params)
    this._intervals = params.intervals ?? []
    this._symbol = params.symbol ?? null
    this._root = params.root ?? 6000
    this.voicingStyle = params.voicing ?? null
    this.strumRate = params.strumRate ?? null
    this.strumDirection = params.strumDirection ?? 'up'
    this.spreadAmount = params.spread ?? 0
    this.spreadSeed = params.spreadSeed ?? null
  }

  /**
   * Set chord intervals directly (cents from root).
   */
  intervals(intervals: ChordIntervals): HarmonyBuilder {
    return this.cloneHarmony({ intervals, symbol: null })
  }

  /**
   * Set the root pitch in absolute cents from C0.
   */
  root(root: NotePitch): HarmonyBuilder {
    return this.cloneHarmony({ root })
  }

  /** Apply drop-2 voicing. */
  drop2(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'drop2' })
  }

  /** Apply open voicing. */
  open(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'open' })
  }

  /** Apply close voicing (default). */
  close(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'close' })
  }

  /**
   * Enable strummed emission. Each note is offset by rate ticks.
   */
  strum(rate: number, direction: 'up' | 'down' = 'up'): HarmonyBuilder {
    return this.cloneHarmony({ strumRate: rate, strumDirection: direction })
  }

  /**
   * Add randomized tick offset per note for humanized timing.
   */
  spread(amount: number, seed?: number): HarmonyBuilder {
    return this.cloneHarmony({ spread: amount, spreadSeed: seed ?? null })
  }

  /**
   * Resolve chord intervals and emit all chord tones.
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    let target = this.applyFlags(bridge)
    const scaledDuration = this.resolvedDuration(bridge)

    // Resolve intervals: symbol-based or direct
    let chordIntervals: ChordIntervals
    let root: number

    const notation = bridge.notation()

    if (this._symbol !== null) {
      chordIntervals = notation.chordToIntervals(this._symbol as ChordSymbol)

      // Parse root from symbol if possible, fall back to stored root
      try {
        const rootNote = (this._symbol as string).match(/^[A-G][#b]?/)?.[0]
        root = rootNote ? notation.noteToCents((rootNote + '4') as NoteName) : notation.noteToCents(this._root)
      } catch {
        root = notation.noteToCents(this._root)
      }
    } else {
      chordIntervals = this._intervals
      root = notation.noteToCents(this._root)
    }

    const resolvedRoot = root
      + this.shared.accidental
      + (this.shared.octaveShift * 1200)
      + this.shared.transposeCents

    const pitches = this.resolvePitches(chordIntervals, resolvedRoot)
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

  /** @internal Creates a new HarmonyBuilder preserving harmony-specific state. */
  protected create(params: Partial<PitchStepParams>): HarmonyBuilder {
    return new HarmonyBuilder({
      ...params,
      intervals: this._intervals,
      symbol: this._symbol,
      root: this._root,
      voicing: this.voicingStyle,
      strumRate: this.strumRate,
      strumDirection: this.strumDirection,
      spread: this.spreadAmount,
      spreadSeed: this.spreadSeed,
    })
  }

  /**
   * Resolve pitches from intervals using the voicing function or raw addition.
   */
  private resolvePitches(intervals: ChordIntervals, resolvedRoot: number): number[] {
    if (this.voicingStyle !== null) {
      const voicingFn = this.voicingStyle === 'drop2' ? drop2Voicing
        : this.voicingStyle === 'open' ? openVoicing
        : closeVoicing

      const rawPitches = voicingFn(intervals, 4, 4)
      const pitches = new Array<number>(rawPitches.length)

      // Rebase: voicing functions place around centerOctave * 1200.
      // We want them relative to resolvedRoot instead.
      const voicingCenter = 4 * 1200
      for (let i = 0; i < rawPitches.length; ++i) {
        pitches[i] = rawPitches[i] - voicingCenter + resolvedRoot
      }

      return pitches
    }

    // Raw intervals: each is already in cents
    const pitches = new Array<number>(intervals.length)
    for (let i = 0; i < intervals.length; ++i) {
      pitches[i] = resolvedRoot + intervals[i]
    }

    return pitches
  }

  /**
   * Emit chord notes with sequential strum offset.
   */
  private emitStrum(
    bridge: CompositionBridge,
    pitches: number[],
    startTick: number,
    duration: number | undefined,
  ): CompositionBridge {
    let target = bridge

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

  /**
   * Emit chord notes simultaneously with optional Knuth-LCG spread.
   */
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

  /** Imperative array reverse (avoids Array.prototype.reverse mutation). */
  private reverseArray(source: number[]): number[] {
    const result = new Array<number>(source.length)
    const last = source.length - 1

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[last - i]
    }

    return result
  }

  /** @internal Clone with harmony-specific overrides. */
  private cloneHarmony(overrides: Partial<HarmonyParams>): HarmonyBuilder {
    return new HarmonyBuilder({
      ...this.shared,
      intervals: overrides.intervals ?? this._intervals,
      symbol: overrides.symbol !== undefined ? overrides.symbol : this._symbol,
      root: overrides.root ?? this._root,
      voicing: overrides.voicing !== undefined ? overrides.voicing : this.voicingStyle,
      strumRate: overrides.strumRate !== undefined ? overrides.strumRate : this.strumRate,
      strumDirection: overrides.strumDirection ?? this.strumDirection,
      spread: overrides.spread !== undefined ? overrides.spread : this.spreadAmount,
      spreadSeed: overrides.spreadSeed !== undefined ? overrides.spreadSeed : this.spreadSeed,
    })
  }
}
