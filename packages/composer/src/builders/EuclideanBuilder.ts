import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { euclidean, rotatePattern, noteToMidi } from '@symphonyscript/theory'
import type { NotePitch } from '../types'

export interface EuclideanParams {
  hits: number
  steps: number
  notes: NotePitch[]
  stepDuration: number | null
  velocity: number | null
  rotation: number
  repeatCount: number
  seed: number | null
}

export class EuclideanBuilder implements PipeStep {
  private readonly params: EuclideanParams

  constructor(params: Partial<EuclideanParams>) {
    this.params = {
      hits: params.hits ?? 1,
      steps: params.steps ?? 4,
      notes: params.notes ?? [],
      stepDuration: params.stepDuration ?? null,
      velocity: params.velocity ?? null,
      rotation: params.rotation ?? 0,
      repeatCount: params.repeatCount ?? 1,
      seed: params.seed ?? null,
    }
  }

  private clone(overrides: Partial<EuclideanParams>): EuclideanBuilder {
    return new EuclideanBuilder({ ...this.params, ...overrides })
  }

  notes(notes: NotePitch[]): EuclideanBuilder {
    return this.clone({ notes })
  }

  stepDuration(stepDuration: number): EuclideanBuilder {
    return this.clone({ stepDuration })
  }

  velocity(velocity: number): EuclideanBuilder {
    return this.clone({ velocity })
  }

  rotation(rotation: number): EuclideanBuilder {
    return this.clone({ rotation })
  }

  repeat(count: number): EuclideanBuilder {
    return this.clone({ repeatCount: count })
  }

  seed(seed: number): EuclideanBuilder {
    return this.clone({ seed })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    let pattern = euclidean(this.params.hits, this.params.steps)
    if (pattern === null || pattern.length === 0) return bridge

    if (this.params.rotation !== 0) {
      pattern = rotatePattern(pattern, this.params.rotation)
    }

    // Resolve note pitches
    const pitches: number[] = new Array(this.params.notes.length)
    for (let i = 0; i < this.params.notes.length; ++i) {
      const input = this.params.notes[i]
      if (typeof input === 'string') {
        const midi = noteToMidi(input)
        if (midi === null) {
          throw new Error(`Invalid note in euclidean: ${input}`)
        }
        pitches[i] = midi
      } else {
        pitches[i] = input
      }
    }

    if (pitches.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge
    let noteIndex = 0

    for (let repeat = 0; repeat < this.params.repeatCount; ++repeat) {
      for (let step = 0; step < pattern.length; ++step) {
        if (pattern[step]) {
          target = target.withNote(
            pitches[noteIndex % pitches.length],
            duration,
            this.params.velocity ?? undefined,
          )
          noteIndex++
        } else {
          target = target.withTick(target.tick + duration)
        }
      }
    }

    return target
  }
}
