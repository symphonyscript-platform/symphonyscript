import type { CompositionBridge } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import type { ScopeEntry } from './ScopedEffectBuilder'
import { TransformEffect } from './TransformEffect'

export interface StretchParams {
  factor: number
  entries: ScopeEntry[]
}

export class StretchBuilder extends TransformEffect<StretchBuilder> {
  private readonly _factor: number

  constructor(params: Partial<StretchParams> = {}) {
    super(params.entries ?? [])
    this._factor = params.factor ?? 1
  }

  factor(factor: number): StretchBuilder {
    return new StretchBuilder({ factor, entries: this.entries })
  }

  protected cloneWithEntries(entries: ScopeEntry[]): StretchBuilder {
    return new StretchBuilder({ factor: this._factor, entries })
  }

  protected replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge {
    const sorted: CapturedNote[] = []

    for (let i = 0; i < notes.length; ++i) {
      sorted.push(notes[i])
    }

    sorted.sort((a, b) => a.tick - b.tick)

    let target = bridge

    for (let i = 0; i < sorted.length; ++i) {
      const note = sorted[i]
      target = target
        .withTick(bridge.tick + Math.round(note.tick * this._factor))
        .withNote(
          note.pitch,
          Math.round(note.duration * this._factor),
          note.velocity,
        )
    }

    return target.withTick(bridge.tick + Math.round(totalDuration * this._factor))
  }
}
