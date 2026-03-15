import type { PipeStep } from '@symphonyscript/composer'
import { ScaledDurationBuilder, ScaledDurationParams } from './ScaledDurationBuilder'

export class PolyrhythmBuilder extends ScaledDurationBuilder {
  constructor(params: Partial<ScaledDurationParams>) {
    super(params)
  }

  override overBeats(overBeats: number): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, overBeats })
  }

  override noteCount(noteCount: number): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, noteCount })
  }

  override steps(...pipeSteps: PipeStep[]): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, pipeSteps })
  }

  protected override clone(overrides: Partial<ScaledDurationParams>): PolyrhythmBuilder {
    return new PolyrhythmBuilder({ ...this.params, ...overrides })
  }
}
