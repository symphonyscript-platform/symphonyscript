import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'

export interface DegreeChordParams {
  degrees: number[]
  duration: number | null
}

export class DegreeChordBuilder implements PipeStep {
  private readonly params: DegreeChordParams

  constructor(params: Partial<DegreeChordParams>) {
    this.params = {
      degrees: params.degrees ?? [],
      duration: params.duration ?? null,
    }
  }

  private clone(overrides: Partial<DegreeChordParams>): DegreeChordBuilder {
    return new DegreeChordBuilder({ ...this.params, ...overrides })
  }

  degrees(degrees: number[]): DegreeChordBuilder {
    return this.clone({ degrees })
  }

  duration(duration: number): DegreeChordBuilder {
    return this.clone({ duration })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.degrees.length === 0) return bridge

    const scaleMode = bridge.scaleMode as ScaleMode
    const startTick = bridge.tick
    const resolvedDuration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < this.params.degrees.length; ++i) {
      const pitch = degreeToPitch(
        this.params.degrees[i],
        bridge.scaleRoot,
        scaleMode,
        4,
      )

      if (pitch === null) continue

      target = target
        .withTick(startTick)
        .withNote(pitch, resolvedDuration, undefined)
    }

    target = target.withTick(startTick + resolvedDuration)

    return target
  }
}
