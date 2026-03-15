import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { NotePitch } from '../types'
import { resolvePitches } from '../utils/pitch'

export interface StepsParams {
  pattern: number[]
  notes: NotePitch[]
  stepDuration: number | null
}

export class StepsBuilder implements PipeStep {
  private readonly params: StepsParams

  constructor(params: Partial<StepsParams>) {
    this.params = {
      pattern: params.pattern ?? [],
      notes: params.notes ?? [],
      stepDuration: params.stepDuration ?? null,
    }
  }

  pattern(pattern: number[]): StepsBuilder {
    return this.clone({ pattern })
  }

  notes(notes: NotePitch[]): StepsBuilder {
    return this.clone({ notes })
  }

  stepDuration(stepDuration: number): StepsBuilder {
    return this.clone({ stepDuration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.pattern.length === 0 || this.params.notes.length === 0) return bridge

    const duration = this.params.stepDuration ?? bridge.defaultDuration
    const pitches = resolvePitches(this.params.notes)
    let target = bridge
    let noteIndex = 0

    for (let i = 0; i < this.params.pattern.length; ++i) {
      if (this.params.pattern[i]) {
        target = target.withNote(
          pitches[noteIndex % pitches.length],
          duration,
        )
        noteIndex++
      } else {
        target = target.withTick(target.tick + duration)
      }
    }

    return target
  }

  private clone(overrides: Partial<StepsParams>): StepsBuilder {
    return new StepsBuilder({ ...this.params, ...overrides })
  }
}
