import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { ArpPattern } from '@symphonyscript/theory'
import type { NotePitch } from '../types'
import { resolvePitches } from '../utils/pitch'

export interface ArpeggioParams {
  pitches: NotePitch[]
  rate: number | null
  pattern: ArpPattern
  velocity: number | null
  gate: number
  octaves: number
  seed: number | null
}

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

  pattern(pattern: ArpPattern): ArpeggioBuilder {
    return this.clone({ pattern })
  }

  pitches(pitches: NotePitch[]): ArpeggioBuilder {
    return this.clone({ pitches })
  }

  velocity(velocity: number): ArpeggioBuilder {
    return this.clone({ velocity })
  }

  gate(gate: number): ArpeggioBuilder {
    return this.clone({ gate })
  }

  octaves(octaves: number): ArpeggioBuilder {
    return this.clone({ octaves })
  }

  seed(seed: number): ArpeggioBuilder {
    return this.clone({ seed })
  }

  rate(rate: number): ArpeggioBuilder {
    return this.clone({ rate })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitches.length === 0) return bridge

    const pool = this.buildPool(resolvePitches(this.params.pitches))
    const sequence = this.buildSequence(pool)

    return this.emitSequence(sequence, bridge)
  }

  private clone(overrides: Partial<ArpeggioParams>): ArpeggioBuilder {
    return new ArpeggioBuilder({ ...this.params, ...overrides })
  }

  /** Expand base pitches across octaves and sort ascending. */
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

  /** Emit the note sequence onto the bridge. */
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

  /** Build the ordered sequence from the pool based on pattern. */
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

  private copyArray(source: number[]): number[] {
    const result = new Array<number>(source.length)

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[i]
    }

    return result
  }

  private reverseArray(source: number[]): number[] {
    const result = new Array<number>(source.length)
    const last = source.length - 1

    for (let i = 0; i < source.length; ++i) {
      result[i] = source[last - i]
    }

    return result
  }

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
