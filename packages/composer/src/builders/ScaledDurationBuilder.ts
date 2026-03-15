import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface ScaledDurationParams {
  noteCount: number
  overBeats: number
  pipeSteps: PipeStep[]
}

/**
 * Shared base for tuplet and polyrhythm.
 * Both compute totalDuration = overBeats * defaultDuration, then
 * set defaultDuration = totalDuration / noteCount for the contained steps.
 */
export class ScaledDurationBuilder implements PipeStep {
  protected readonly params: ScaledDurationParams

  constructor(params: Partial<ScaledDurationParams>) {
    this.params = {
      noteCount: params.noteCount ?? 3,
      overBeats: params.overBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    }
  }

  overBeats(overBeats: number): ScaledDurationBuilder {
    return this.clone({ overBeats })
  }

  noteCount(noteCount: number): ScaledDurationBuilder {
    return this.clone({ noteCount })
  }

  steps(...pipeSteps: PipeStep[]): ScaledDurationBuilder {
    return this.clone({ pipeSteps })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pipeSteps.length === 0) {
      return bridge
    }

    const totalDuration = this.params.overBeats * bridge.defaultDuration
    const scaledDuration = Math.round(totalDuration / this.params.noteCount)
    let target = bridge.withDefaultDuration(scaledDuration)

    for (let i = 0; i < this.params.pipeSteps.length; ++i) {
      target = this.params.pipeSteps[i].apply(target)
    }

    return target
  }

  protected clone(overrides: Partial<ScaledDurationParams>): ScaledDurationBuilder {
    return new ScaledDurationBuilder({ ...this.params, ...overrides })
  }
}
