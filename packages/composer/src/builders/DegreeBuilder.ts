import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'

export interface DegreeParams {
  degree: number
  duration: number | null
  velocity: number | null
  octaveShift: number
  accidental: number
  precise: boolean
  muted: boolean
}

export class DegreeBuilder implements PipeStep {
  private readonly params: DegreeParams

  constructor(params: Partial<DegreeParams>) {
    this.params = {
      degree: params.degree ?? 1,
      duration: params.duration ?? null,
      velocity: params.velocity ?? null,
      octaveShift: params.octaveShift ?? 0,
      accidental: params.accidental ?? 0,
      precise: params.precise ?? false,
      muted: params.muted ?? false,
    }
  }

  velocity(velocity: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, velocity })
  }

  duration(duration: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, duration })
  }

  sharp(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, accidental: this.params.accidental + 1 })
  }

  flat(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, accidental: this.params.accidental - 1 })
  }

  natural(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, accidental: 0 })
  }

  octave(shift: number): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, octaveShift: shift })
  }

  up(octaves: number = 1): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, octaveShift: this.params.octaveShift + octaves })
  }

  down(octaves: number = 1): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, octaveShift: this.params.octaveShift - octaves })
  }

  precise(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, precise: true })
  }

  muted(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, muted: true })
  }

  accent(): DegreeBuilder {
    return new DegreeBuilder({ ...this.params, velocity: 1200, precise: true })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const pitch = degreeToPitch(
      this.params.degree,
      bridge.scaleRoot,
      bridge.scaleMode,
      4,
      this.params.accidental,
      this.params.octaveShift,
    )

    if (pitch === null) return bridge

    let target = bridge

    if (this.params.precise) {
      target = target.withPrecise(true)
    }

    if (this.params.muted) {
      target = target.withMuted(true)
    }

    target = target.withNote(
      pitch,
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

