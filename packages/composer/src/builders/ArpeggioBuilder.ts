import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { noteToMidi } from '@symphonyscript/theory'
import type { NotePitch } from '../types'

export type ArpPattern = 'up' | 'down' | 'upDown' | 'downUp' | 'random' | 'converge' | 'diverge'

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

  private clone(overrides: Partial<ArpeggioParams>): ArpeggioBuilder {
    return new ArpeggioBuilder({ ...this.params, ...overrides })
  }

  pattern(pattern: ArpPattern): ArpeggioBuilder {
    return this.clone({ pattern })
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

    // Resolve pitches to MIDI numbers
    const baseMidis: number[] = []
    for (let i = 0; i < this.params.pitches.length; ++i) {
      const input = this.params.pitches[i]
      if (typeof input === 'string') {
        const midi = noteToMidi(input)
        if (midi === null) {
          throw new Error(`Invalid note in arpeggio: ${input}`)
        }
        baseMidis.push(midi)
      } else {
        baseMidis.push(input)
      }
    }

    // Expand octaves
    const pool: number[] = []
    for (let octave = 0; octave < this.params.octaves; ++octave) {
      for (let i = 0; i < baseMidis.length; ++i) {
        pool.push(baseMidis[i] + (octave * 12))
      }
    }

    // Sort ascending (insertion sort — no closure allocation)
    for (let i = 1; i < pool.length; ++i) {
      const current = pool[i]
      let j = i - 1
      while (j >= 0 && pool[j] > current) {
        pool[j + 1] = pool[j]
        j--
      }
      pool[j + 1] = current
    }

    // Apply pattern
    const sequence = this.buildSequence(pool)

    // Emit notes
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

  private buildSequence(pool: number[]): number[] {
    switch (this.params.pattern) {
      case 'up':
        return pool.slice()

      case 'down':
        return pool.slice().reverse()

      case 'upDown': {
        const result = pool.slice()
        for (let i = pool.length - 2; i > 0; --i) {
          result.push(pool[i])
        }
        return result
      }

      case 'downUp': {
        const reversed = pool.slice().reverse()
        const result = reversed.slice()
        for (let i = reversed.length - 2; i > 0; --i) {
          result.push(reversed[i])
        }
        return result
      }

      case 'random': {
        const result = pool.slice()
        // Simple seeded shuffle (Fisher-Yates)
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

      case 'converge': {
        const result: number[] = []
        let left = 0
        let right = pool.length - 1
        while (left <= right) {
          result.push(pool[left])
          if (left !== right) {
            result.push(pool[right])
          }
          left++
          right--
        }
        return result
      }

      case 'diverge': {
        const result: number[] = []
        const mid = Math.floor(pool.length / 2)
        let left = mid - 1
        let right = mid

        if (pool.length % 2 !== 0) {
          result.push(pool[mid])
          right = mid + 1
        }

        while (left >= 0 || right < pool.length) {
          if (right < pool.length) result.push(pool[right++])
          if (left >= 0) result.push(pool[left--])
        }
        return result
      }

      default:
        return pool.slice()
    }
  }
}
