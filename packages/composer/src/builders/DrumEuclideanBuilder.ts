import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { euclidean, rotatePattern } from '@symphonyscript/theory'

export interface DrumEuclideanParams {
  hits: number
  steps: number
  pitch: number | null
  stepDuration: number | null
  rotation: number
}

export class DrumEuclideanBuilder implements PipeStep {
  private readonly params: DrumEuclideanParams

  constructor(params: Partial<DrumEuclideanParams>) {
    this.params = {
      hits: params.hits ?? 1,
      steps: params.steps ?? 4,
      pitch: params.pitch ?? null,
      stepDuration: params.stepDuration ?? null,
      rotation: params.rotation ?? 0,
    }
  }

  private clone(overrides: Partial<DrumEuclideanParams>): DrumEuclideanBuilder {
    return new DrumEuclideanBuilder({ ...this.params, ...overrides })
  }

  pitch(pitch: number): DrumEuclideanBuilder {
    return this.clone({ pitch })
  }

  stepDuration(stepDuration: number): DrumEuclideanBuilder {
    return this.clone({ stepDuration })
  }

  rotation(rotation: number): DrumEuclideanBuilder {
    return this.clone({ rotation })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    let pattern = euclidean(this.params.hits, this.params.steps)
    if (pattern === null) return bridge

    if (this.params.rotation !== 0) {
      pattern = rotatePattern(pattern, this.params.rotation)
    }

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < pattern.length; ++i) {
      if (pattern[i]) {
        target = target.withNote(this.params.pitch, duration)
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  }
}
