import type { CompositionBridge } from '@symphonyscript/composer'
import type { CapturedNote } from '../interfaces/captured-note'
import type { PipeStep } from '@symphonyscript/composer'
import { TransformEffect } from './TransformEffect'

export class ReverseBuilder extends TransformEffect<ReverseBuilder> {
  constructor(entries: PipeStep[][] = []) {
    super(entries)
  }

  protected cloneWithEntries(entries: PipeStep[][]): ReverseBuilder {
    return new ReverseBuilder(entries)
  }

  protected replay(
    notes: CapturedNote[],
    totalDuration: number,
    bridge: CompositionBridge,
  ): CompositionBridge {
    // Reverse tick positions: new_tick = totalDuration - original_tick - duration
    const reversed: CapturedNote[] = []

    for (let i = 0; i < notes.length; ++i) {
      const note = notes[i]
      reversed.push({
        pitch: note.pitch,
        velocity: note.velocity,
        duration: note.duration,
        tick: totalDuration - note.tick - note.duration,
        muted: note.muted,
      })
    }

    reversed.sort((a, b) => a.tick - b.tick)

    let target = bridge

    for (let i = 0; i < reversed.length; ++i) {
      const note = reversed[i]
      target = target.withTick(bridge.tick + note.tick)
      target = target.withNote(note.pitch, note.duration, note.velocity)
    }

    return target.withTick(bridge.tick + totalDuration)
  }
}
