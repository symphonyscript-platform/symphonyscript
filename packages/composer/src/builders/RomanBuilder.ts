import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'

export interface RomanParams {
  numeral: string
  duration: number | null
  inversion: number
  velocity: number | null
}

/**
 * Roman numeral → scale degrees mapping.
 * Both upper and lowercase map to the same degrees (quality is determined by scale).
 */
const ROMAN_MAP: Readonly<Record<string, readonly number[]>> = {
  'I': [1, 3, 5], 'i': [1, 3, 5],
  'II': [2, 4, 6], 'ii': [2, 4, 6],
  'III': [3, 5, 7], 'iii': [3, 5, 7],
  'IV': [4, 6, 8], 'iv': [4, 6, 8],
  'V': [5, 7, 9], 'v': [5, 7, 9],
  'VI': [6, 8, 10], 'vi': [6, 8, 10],
  'VII': [7, 9, 11], 'vii': [7, 9, 11],
  'I7': [1, 3, 5, 7], 'i7': [1, 3, 5, 7],
  'II7': [2, 4, 6, 8], 'ii7': [2, 4, 6, 8],
  'III7': [3, 5, 7, 9], 'iii7': [3, 5, 7, 9],
  'IV7': [4, 6, 8, 10], 'iv7': [4, 6, 8, 10],
  'V7': [5, 7, 9, 11], 'v7': [5, 7, 9, 11],
  'VI7': [6, 8, 10, 12], 'vi7': [6, 8, 10, 12],
  'VII7': [7, 9, 11, 13], 'vii7': [7, 9, 11, 13],
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
    const baseDegrees = ROMAN_MAP[this.params.numeral]
    if (!baseDegrees) {
      throw new Error(`Unknown roman numeral: ${this.params.numeral}`)
    }

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
