import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { applyBinaryPattern } from '../utils/binary-pattern'
import { generateEuclideanPattern } from '../utils/euclidean-pattern'

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

  pitch(pitch: number): DrumEuclideanBuilder {
    return this.clone({ pitch })
  }

  hits(hits: number): DrumEuclideanBuilder {
    return this.clone({ hits })
  }

  steps(steps: number): DrumEuclideanBuilder {
    return this.clone({ steps })
  }

  stepDuration(stepDuration: number): DrumEuclideanBuilder {
    return this.clone({ stepDuration })
  }

  rotation(rotation: number): DrumEuclideanBuilder {
    return this.clone({ rotation })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pitch === null) return bridge

    const pattern = generateEuclideanPattern(
      this.params.hits,
      this.params.steps,
      this.params.rotation,
    )

    if (pattern === null) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration

    return applyBinaryPattern(pattern, [this.params.pitch], duration, bridge)
  }

  private clone(overrides: Partial<DrumEuclideanParams>): DrumEuclideanBuilder {
    return new DrumEuclideanBuilder({ ...this.params, ...overrides })
  }
}
