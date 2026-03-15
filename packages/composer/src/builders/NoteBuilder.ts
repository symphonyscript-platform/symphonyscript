import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { noteToMidi } from '@symphonyscript/theory'

export interface NoteParams {
  pitch: number
  duration: number | null
  velocity: number | null
  octaveShift: number
  accidental: number
  precise: boolean
  muted: boolean
}

export class NoteBuilder implements PipeStep {
  private readonly params: NoteParams

  constructor(params: Partial<NoteParams>) {
    this.params = {
      pitch: params.pitch ?? 60,
      duration: params.duration ?? null,
      velocity: params.velocity ?? null,
      octaveShift: params.octaveShift ?? 0,
      accidental: params.accidental ?? 0,
      precise: params.precise ?? false,
      muted: params.muted ?? false,
    }
  }

  velocity(velocity: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, velocity })
  }

  duration(duration: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, duration })
  }

  sharp(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: this.params.accidental + 1 })
  }

  flat(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: this.params.accidental - 1 })
  }

  natural(): NoteBuilder {
    return new NoteBuilder({ ...this.params, accidental: 0 })
  }

  octave(shift: number): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: shift })
  }

  up(octaves: number = 1): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: this.params.octaveShift + octaves })
  }

  down(octaves: number = 1): NoteBuilder {
    return new NoteBuilder({ ...this.params, octaveShift: this.params.octaveShift - octaves })
  }

  precise(): NoteBuilder {
    return new NoteBuilder({ ...this.params, precise: true })
  }

  muted(): NoteBuilder {
    return new NoteBuilder({ ...this.params, muted: true })
  }

  accent(): NoteBuilder {
    return new NoteBuilder({ ...this.params, velocity: 1200, precise: true })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const finalPitch = this.params.pitch
      + this.params.accidental
      + (this.params.octaveShift * 12)

    let target = bridge

    if (this.params.precise) {
      target = target.withPrecise(true)
    }

    if (this.params.muted) {
      target = target.withMuted(true)
    }

    target = target.withNote(
      finalPitch,
      this.params.duration ?? undefined,
      this.params.velocity ?? undefined,
    )

    if (this.params.precise) {
      target = target.withPrecise(false)
    }

    if (this.params.muted) {
      target = target.withMuted(false)
    }

    return target
  }
}
