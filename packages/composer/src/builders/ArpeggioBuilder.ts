import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { ArpPattern } from '@symphonyscript/theory'
import type { NotePitch } from '../types'
import { resolvePitches } from '../utils/pitch'

/**
 * Parameters for {@link ArpeggioBuilder}.
 *
 * Controls note order, timing, and articulation of arpeggiated chord/notes.
 */
export interface ArpeggioParams {
  /** Input pitches (literal note names or MIDI numbers). Resolved via {@link resolvePitches}. */
  pitches: NotePitch[]
  /** Tick duration per arpeggio step. `null` = use bridge default at apply-time. */
  rate: number | null
  /** Ordering pattern: `'up'`, `'down'`, `'upDown'`, `'downUp'`, `'random'`, `'converge'`, `'diverge'`. */
  pattern: ArpPattern
  /** Velocity override for emitted notes. `null` = use bridge default. */
  velocity: number | null
  /** Note-on fraction of step duration (0–1). 1.0 = legato; values less than 1 create gaps. Default: 1.0. */
  gate: number
  /** Number of octaves to expand the pitch pool. Default: 1. */
  octaves: number
  /** Seed for `'random'` pattern. `null` = tick-derived or `Date.now()`. */
  seed: number | null
}

/**
 * Immutable builder for arpeggiating chord or note sequences.
 *
 * Resolves pitches via {@link resolvePitches}, expands them across octaves, orders
 * them by pattern, then emits each note sequentially with per-step timing and gate.
 * Does not extend {@link PitchStepBuilder}; uses its own param model.
 *
 * All builder methods return new instances (clone-on-set immutability).
 *
 * @example
 * ```ts
 * arpeggio(['C4', 'E4', 'G4'])                    // Up pattern, bridge default rate
 * arpeggio(['Am'], 120).pattern('down')           // A minor, down, 120 ticks/step
 * arpeggio(['C4', 'E4'], 60).pattern('upDown')    // Up-down cycle
 * arpeggio(['Cmaj7']).octaves(2).gate(0.8)       // Two octaves, 80% gate
 * arpeggio(['G4', 'B4', 'D5']).pattern('random').seed(42)
 * ```
 */
export class ArpeggioBuilder implements PipeStep {
  private readonly params: ArpeggioParams

  constructor(params: Partial<ArpeggioParams>) {
    this.params = {
      pitches: params.pitches ?? [],
      rate: params.rate ?? null,
      pattern: params.pattern ?? 'up',
      velocity: params.velocity ?? null,
      gate: params.gate ?? 1.0,
      octaves: params.octaves ?? 1,
      seed: params.seed ?? null,
    }
  }

  /**
   * Set the ordering pattern for arpeggio notes.
   *
   * @param pattern - One of `'up'`, `'down'`, `'upDown'`, `'downUp'`, `'random'`, `'converge'`, `'diverge'`
   * @returns New ArpeggioBuilder with the updated pattern
   */
  pattern(pattern: ArpPattern): ArpeggioBuilder {
    return this.clone({ pattern })
  }

  /**
   * Set the input pitches (chord or note list) to arpeggiate.
   *
   * Pitches are resolved via {@link resolvePitches} at apply-time and expanded
   * across octaves before applying the pattern.
   *
   * @param pitches - Array of literal note names (e.g. `'C4'`) or MIDI numbers
   * @returns New ArpeggioBuilder with the updated pitches
   */
  pitches(pitches: NotePitch[]): ArpeggioBuilder {
    return this.clone({ pitches })
  }

  /**
   * Set velocity for emitted notes.
   *
   * @param velocity - Velocity value for all arpeggiated notes
   * @returns New ArpeggioBuilder with the updated velocity
   */
  velocity(velocity: number): ArpeggioBuilder {
    return this.clone({ velocity })
  }

  /**
   * Set the gate ratio: note-on fraction of each step duration.
   *
   * Values less than 1 create gaps between notes (e.g. staccato feel).
   *
   * @param gate - Ratio 0–1 (1.0 = full step, 0.5 ≈ staccato)
   * @returns New ArpeggioBuilder with the updated gate
   */
  gate(gate: number): ArpeggioBuilder {
    return this.clone({ gate })
  }

  /**
   * Set how many octaves to expand the pitch pool.
   *
   * Each base pitch is duplicated at +12, +24, … semitones before sorting and
   * applying the pattern.
   *
   * @param octaves - Number of octaves (≥ 1)
   * @returns New ArpeggioBuilder with the updated octave count
   */
  octaves(octaves: number): ArpeggioBuilder {
    return this.clone({ octaves })
  }

  /**
   * Set seed for reproducible `'random'` pattern ordering.
   *
   * @param seed - Seed value for the Fisher-Yates shuffle
   * @returns New ArpeggioBuilder with the updated seed
   */
  seed(seed: number): ArpeggioBuilder {
    return this.clone({ seed })
  }

  /**
   * Set tick duration per arpeggio step.
   *
   * @param rate - Ticks between consecutive note onsets
   * @returns New ArpeggioBuilder with the updated rate
   */
  rate(rate: number): ArpeggioBuilder {
    return this.clone({ rate })
  }

  /**
   * Resolve pitches, build the ordered sequence from the pattern, and emit notes.
   *
   * **Pipeline:**
   * 1. Resolve pitches via {@link resolvePitches}
   * 2. Expand across octaves and sort ascending (buildPool)
   * 3. Reorder by pattern (up, down, upDown, downUp, random, converge, diverge)
   * 4. Emit each note at `rate` ticks apart, with `gate` applied to note duration
   *
   * Returns the bridge unchanged when `pitches` is empty.
   *
   * @param bridge - Current composition state
   * @returns Updated bridge with arpeggiated notes emitted
   */
  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitches.length === 0) return bridge

    const pool = this.buildPool(resolvePitches(this.params.pitches))
    const sequence = this.buildSequence(pool)

    return this.emitSequence(sequence, bridge)
  }

  /** @internal Clone with param overrides. */
  private clone(overrides: Partial<ArpeggioParams>): ArpeggioBuilder {
    return new ArpeggioBuilder({ ...this.params, ...overrides })
  }

  /**
   * Expand base MIDI pitches across octaves and sort ascending.
   *
   * Each pitch is copied at +0, +12, +24, … for `octaves` octaves.
   */
  private buildPool(baseMidis: number[]): number[] {
    const pool: number[] = []

    for (let octave = 0; octave < this.params.octaves; ++octave) {
      for (let i = 0; i < baseMidis.length; ++i) {
        pool.push(baseMidis[i] + (octave * 12))
      }
    }

    pool.sort((a, b) => a - b)

    return pool
  }

  /**
   * Emit each pitch in the sequence onto the bridge at `rate`-tick intervals.
   *
   * Note duration = `rate * gate`. When gate is less than 1, advances tick by `rate` after each note.
   */
  private emitSequence(sequence: number[], bridge: CompositionBridge): CompositionBridge {
    const stepDuration = this.params.rate ?? bridge.defaultDuration
    const noteDuration = Math.round(stepDuration * this.params.gate)
    const restDuration = stepDuration - noteDuration
    let target = bridge

    for (let i = 0; i < sequence.length; ++i) {
      target = target.withNote(
        sequence[i],
        noteDuration,
        this.params.velocity ?? undefined,
      )

      if (restDuration > 0 && this.params.gate < 1.0) {
        target = target.withTick(target.tick + restDuration)
      }
    }

    return target
  }

  /**
   * Build the ordered note sequence from the sorted pool using the configured pattern.
   *
   * Delegates to pattern-specific helpers (up, down, upDown, downUp, random, converge, diverge).
   */
  private buildSequence(pool: number[]): number[] {
    switch (this.params.pattern) {
      case 'up':
        return this.copyArray(pool)

      case 'down':
        return this.reverseArray(pool)

      case 'upDown':
        return this.buildUpDown(pool)

      case 'downUp':
        return this.buildDownUp(pool)

      case 'random':
        return this.buildRandom(pool)

      case 'converge':
        return this.buildConverge(pool)

      case 'diverge':
        return this.buildDiverge(pool)

      default:
        return this.copyArray(pool)
    }
  }

  /** @internal Shallow copy without mutating source. */
  private copyArray(source: number[]): number[] {
    const result = new Array<number>(source.length)

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[i]
    }

    return result
  }

  /** @internal Imperative reverse without mutating source. */
  private reverseArray(source: number[]): number[] {
    const result = new Array<number>(source.length)
    const last = source.length - 1

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[last - i]
    }

    return result
  }

  /** Up then inner reversed (no duplicate endpoints). */
  private buildUpDown(pool: number[]): number[] {
    // up + inner reversed (no duplicated endpoints)
    const result: number[] = []

    for (let i = 0; i < pool.length; ++i) {
      result.push(pool[i])
    }

    for (let i = pool.length - 2; i > 0; --i) {
      result.push(pool[i])
    }

    return result
  }

  /** Down then inner reversed (no duplicate endpoints). */
  private buildDownUp(pool: number[]): number[] {
    const reversed = this.reverseArray(pool)
    const result: number[] = []

    for (let i = 0; i < reversed.length; ++i) {
      result.push(reversed[i])
    }

    for (let i = reversed.length - 2; i > 0; --i) {
      result.push(reversed[i])
    }

    return result
  }

  /** Fisher-Yates shuffle with seeded LCG for reproducibility. */
  private buildRandom(pool: number[]): number[] {
    const result = this.copyArray(pool)
    let seedValue = this.params.seed ?? Date.now()

    for (let i = result.length - 1; i > 0; --i) {
      seedValue = (seedValue * 1664525 + 1013904223) & 0x7fffffff
      const j = seedValue % (i + 1)
      const temp = result[i]
      result[i] = result[j]
      result[j] = temp
    }

    return result
  }

  /** Alternate from both ends toward center (left, right, left, right, …). */
  private buildConverge(pool: number[]): number[] {
    const result: number[] = []
    let left = 0
    let right = pool.length - 1

    while (left <= right) {
      result.push(pool[left])
      if (left !== right) {
        result.push(pool[right])
      }
      ++left
      --right
    }

    return result
  }

  /** Alternate outward from center (mid, mid+1, mid-1, mid+2, mid-2, …). */
  private buildDiverge(pool: number[]): number[] {
    const result: number[] = []
    const mid = Math.floor(pool.length / 2)
    let left = mid - 1
    let right = mid

    if (pool.length % 2 !== 0) {
      result.push(pool[mid])
      right = mid + 1
    }

    while (left >= 0 || right < pool.length) {
      if (right < pool.length) {
        result.push(pool[right])
        ++right
      }

      if (left >= 0) {
        result.push(pool[left])
        --left
      }
    }

    return result
  }
}
