import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode, ROMAN_DEGREE_MAP } from '@symphonyscript/theory'
import type { RomanNumeral } from '@symphonyscript/theory'

export interface RomanParams {
  numeral: RomanNumeral
  duration: number | null
  inversion: number
  velocity: number | null
}

export class RomanBuilder implements PipeStep {
  private readonly params: RomanParams

  constructor(params: Partial<RomanParams>) {
    this.params = {
      numeral: params.numeral ?? 'I',
      duration: params.duration ?? null,
      inversion: params.inversion ?? 0,
      velocity: params.velocity ?? null,
    }
  }

  private clone(overrides: Partial<RomanParams>): RomanBuilder {
    return new RomanBuilder({ ...this.params, ...overrides })
  }

  duration(duration: number): RomanBuilder {
    return this.clone({ duration })
  }

  inversion(inversion: number): RomanBuilder {
    return this.clone({ inversion })
  }

  velocity(velocity: number): RomanBuilder {
    return this.clone({ velocity })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const baseDegrees = ROMAN_DEGREE_MAP[this.params.numeral]

    // Apply inversion: rotate bottom notes up by 7 degrees (one octave in diatonic)
    const degrees: number[] = new Array(baseDegrees.length)
    const scaleMode = bridge.scaleMode as ScaleMode
    const inversionCount = Math.min(this.params.inversion, baseDegrees.length)

    for (let i = 0; i < baseDegrees.length; ++i) {
      const rotatedIndex = (i + inversionCount) % baseDegrees.length
      const octaveBoost = (i + inversionCount) >= baseDegrees.length ? 7 : 0
      degrees[i] = baseDegrees[rotatedIndex] + octaveBoost
    }

    // Resolve degrees to pitches
    const startTick = bridge.tick
    const duration = this.params.duration ?? bridge.defaultDuration
    let target = bridge

    for (let i = 0; i < degrees.length; ++i) {
      const pitch = degreeToPitch(
        degrees[i],
        bridge.scaleRoot,
        scaleMode,
        4,
      )

      if (pitch === null) continue

      target = target
        .withTick(startTick)
        .withNote(pitch, duration, this.params.velocity ?? undefined)
    }

    target = target.withTick(startTick + duration)

    return target
  }
}
