import type { PipeStep } from '@symphonyscript/composer'
import { ScaledDurationBuilder, ScaledDurationParams } from './ScaledDurationBuilder'

export interface TupletParams extends ScaledDurationParams {
  count: number
  inBeats: number
}

export class TupletBuilder extends ScaledDurationBuilder {
  constructor(params: Partial<TupletParams>) {
    super({
      noteCount: params.noteCount ?? params.count ?? 3,
      overBeats: params.overBeats ?? params.inBeats ?? 2,
      pipeSteps: params.pipeSteps ?? [],
    })
  }

  inBeats(inBeats: number): TupletBuilder {
    return new TupletBuilder({ ...this.params, overBeats: inBeats })
  }

  count(count: number): TupletBuilder {
    return new TupletBuilder({ ...this.params, noteCount: count })
  }

  override steps(...pipeSteps: PipeStep[]): TupletBuilder {
    return new TupletBuilder({ ...this.params, pipeSteps })
  }

  protected override clone(overrides: Partial<ScaledDurationParams>): TupletBuilder {
    return new TupletBuilder({ ...this.params, ...overrides })
  }
}
