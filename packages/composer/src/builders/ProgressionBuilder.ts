import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import type { RomanNumeral } from '@symphonyscript/theory'
import { RomanBuilder } from './RomanBuilder'

export interface ProgressionParams {
  numerals: RomanNumeral[]
  duration: number | null
  velocity: number | null
}

/**
 * Chord progression from roman numerals.
 *
 * Usage:
 *   progression(['I', 'IV', 'V', 'I'])
 *   progression(['I', 'vi', 'IV', 'V']).duration(480)
 *   progression(['ii', 'V', 'I']).velocity(900)
 */
export class ProgressionBuilder implements PipeStep {
  private readonly params: ProgressionParams

  constructor(params: Partial<ProgressionParams> = {}) {
    this.params = {
      numerals: params.numerals ?? [],
      duration: params.duration ?? null,
      velocity: params.velocity ?? null,
    }
  }

  numerals(numerals: RomanNumeral[]): ProgressionBuilder {
    return this.clone({ numerals })
  }

  duration(duration: number): ProgressionBuilder {
    return this.clone({ duration })
  }

  velocity(velocity: number): ProgressionBuilder {
    return this.clone({ velocity })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    let target = bridge

    for (let i = 0; i < this.params.numerals.length; ++i) {
      const builder = new RomanBuilder({
        numeral: this.params.numerals[i],
        duration: this.params.duration,
        velocity: this.params.velocity,
      })

      target = builder.apply(target)
    }

    return target
  }

  private clone(overrides: Partial<ProgressionParams>): ProgressionBuilder {
    return new ProgressionBuilder({ ...this.params, ...overrides })
  }
}
