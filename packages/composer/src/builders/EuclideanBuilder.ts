import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitches } from '../utils/pitch'
import { applyBinaryPattern } from '../utils/binary-pattern'
import { generateEuclideanPattern } from '../utils/euclidean-pattern'

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

  notes(notes: NotePitch[]): EuclideanBuilder {
    return this.clone({ notes })
  }

  hits(hits: number): EuclideanBuilder {
    return this.clone({ hits })
  }

  steps(steps: number): EuclideanBuilder {
    return this.clone({ steps })
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
    const pattern = generateEuclideanPattern(
      this.params.hits,
      this.params.steps,
      this.params.rotation,
    )

    if (pattern === null) return bridge

    const pitches = resolvePitches(this.params.notes)
    if (pitches.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.repeatCount; ++i) {
      target = applyBinaryPattern(pattern, pitches, duration, target, this.params.velocity ?? undefined)
    }

    return target
  }

  private clone(overrides: Partial<EuclideanParams>): EuclideanBuilder {
    return new EuclideanBuilder({ ...this.params, ...overrides })
  }
}
