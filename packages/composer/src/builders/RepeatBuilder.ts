import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export interface RepeatParams {
  count: number
  source: PipeStep | null
}

/**
 * Repeat a step n times sequentially.
 *
 * Usage:
 *   repeat(4, note('C4'))
 *   repeat(4, note('C4')).count(8)
 */
export class RepeatBuilder implements PipeStep {
  private readonly params: RepeatParams

  constructor(params: Partial<RepeatParams> = {}) {
    this.params = {
      count: params.count ?? 1,
      source: params.source ?? null,
    }
  }

  count(count: number): RepeatBuilder {
    return this.clone({ count })
  }

  source(source: PipeStep): RepeatBuilder {
    return this.clone({ source })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    if (this.params.source === null) return bridge

    let target = bridge

    for (let i = 0; i < this.params.count; ++i) {
      target = this.params.source.apply(target)
    }

    return target
  }

  private clone(overrides: Partial<RepeatParams>): RepeatBuilder {
    return new RepeatBuilder({ ...this.params, ...overrides })
  }
}
