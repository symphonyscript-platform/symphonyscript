import { CompositionBridge } from '@symphonyscript/composer'
import type { HarmonyMask, VoiceLeadingStyle } from '@symphonyscript/theory'
import { closeVoicing, drop2Voicing, getScaleIntervals, openVoicing } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'
import { KNUTH_MULTIPLIER } from '../constants'

/**
 * Parameters specific to {@link HarmonyBuilder}.
 *
 * Extends {@link PitchStepParams} with chord voicing, strum, and spread fields.
 */
export interface HarmonyParams extends PitchStepParams {
  /** 24-EDO interval bitmask defining the chord structure. */
  mask: HarmonyMask
  /** Root MIDI pitch. Defaults to 60 (C4). */
  root: number
  /** Voicing algorithm: `'close'`, `'open'`, or `'drop2'`. `null` = raw intervals. */
  voicing: VoiceLeadingStyle | null
  /** Tick delay between each strummed note. `null` = simultaneous emission. */
  strumRate: number | null
  /** Strum direction. Only applies when `strumRate` is set. */
  strumDirection: 'up' | 'down'
  /** Maximum random tick offset per note for humanized timing. 0 = no spread. */
  spread: number
  /** Seed for deterministic spread randomization. `null` = tick-derived. */
  spreadSeed: number | null
}

/**
 * Immutable builder for chord/harmony emission.
 *
 * Emits multiple simultaneous notes from a 24-EDO {@link HarmonyMask}.
 * Supports three voicing algorithms (close, open, drop2), strumming,
 * and randomized spread for humanized timing.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * chord('Cmaj7')                          // Close-voiced Cmaj7
 * chord('Am').drop2()                     // Drop-2 voicing
 * chord('G7').strum(30, 'down')           // Downward strum, 30 ticks apart
 * harmony(mask, 'C4').spread(10)          // Humanized timing ±10 ticks
 * chord('Dm').velocity(600).duration(960) // Half-note, soft
 * ```
 */
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

  /**
   * Replace the 24-EDO interval bitmask that defines the chord structure.
   *
   * The mask encodes which intervals (in 24-EDO half-sharps) are present.
   * Use `pack()` from `@symphonyscript/theory` to create masks from interval arrays.
   *
   * @param mask - Packed interval bitmask

   * @returns New HarmonyBuilder with the updated mask
   */
  mask(mask: HarmonyMask): HarmonyBuilder {
    return this.cloneHarmony({ mask })
  }

  /**
   * Set the root MIDI pitch. All chord intervals are computed relative to this.
   *
   * @param root - MIDI note number (e.g. 60 = C4, 67 = G4)

   * @returns New HarmonyBuilder with the updated root
   */
  root(root: number): HarmonyBuilder {
    return this.cloneHarmony({ root })
  }

  /**
   * Apply drop-2 voicing.
   *
   * Moves the second-highest note down an octave, creating wider spacing
   * between upper voices. Common in jazz guitar and big-band arranging.
   *
   * @returns New HarmonyBuilder with drop-2 voicing applied
   */
  drop2(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'drop2' })
  }

  /**
   * Apply open voicing.
   *
   * Distributes chord tones across a wider range by shifting alternate notes
   * up an octave. Produces a spacious, orchestral sound compared to close voicing.
   *
   * @returns New HarmonyBuilder with open voicing applied
   */
  open(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'open' })
  }

  /**
   * Apply close voicing (default).
   *
   * All chord tones are placed in the tightest possible interval spacing
   * within a single octave. This is the standard voicing when no style is set.
   *
   * @returns New HarmonyBuilder with close voicing applied
   */
  close(): HarmonyBuilder {
    return this.cloneHarmony({ voicing: 'close' })
  }

  /**
   * Enable strummed emission. Each note is offset by `rate` ticks.
   *
   * @param rate - Tick delay between consecutive notes
   * @param direction - `'up'` (low→high) or `'down'` (high→low). Defaults to `'up'`.
   */
  strum(rate: number, direction: 'up' | 'down' = 'up'): HarmonyBuilder {
    return this.cloneHarmony({ strumRate: rate, strumDirection: direction })
  }

  /**
   * Add randomized tick offset per note for humanized timing.
   *
   * Each note receives a pseudo-random offset in `[0, amount]` ticks.
   * Uses Knuth LCG seeded from `seed` or the current tick for determinism.
   *
   * @param amount - Maximum spread offset in ticks
   * @param seed - Optional seed for reproducible results
   */
  spread(amount: number, seed?: number): HarmonyBuilder {
    return this.cloneHarmony({ spread: amount, spreadSeed: seed ?? null })
  }

  /**
   * Resolve pitches from the harmony mask and emit all chord tones.
   *
   * **Pipeline:**
   * 1. Compute `resolvedRoot` = root + accidental + octaveShift + transpose
   * 2. Resolve pitches via voicing function or raw 24-EDO intervals
   * 3. For each repeat: emit notes (strummed or simultaneous), advance tick by duration
   *
   * When `strumRate` is set, notes are offset sequentially. Otherwise, all
   * notes emit at the same tick (with optional spread randomization).
   *
   * @param bridge - Current composition state

   * @returns Updated bridge with chord notes emitted
   */
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

  /** @internal Creates a new HarmonyBuilder preserving harmony-specific state. */
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

  /**
   * Resolve pitches from mask using the voicing function or raw intervals.
   *
   * With a voicing style set, delegates to the corresponding `@symphonyscript/theory`
   * voicing function. Otherwise, extracts raw 24-EDO intervals and converts to
   * 12-TET pitches offset from `resolvedRoot`.
   */
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

  /**
   * Emit chord notes with sequential strum offset.
   *
   * For `'down'` direction, pitches are reversed before emission.
   * Each note is placed at `startTick + (index × strumRate)`.
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
   *
   * When `spreadAmount > 0`, each note receives a pseudo-random tick
   * offset in `[0, spreadAmount]` for humanized feel.
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

  /** Imperative array reverse (avoids `Array.prototype.reverse` mutation). */
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
