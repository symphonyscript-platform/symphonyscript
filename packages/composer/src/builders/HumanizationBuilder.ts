import { SeededRandom } from '@symphonyscript/core'
import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { HumanizationBridge, HumanizationBridgeParams } from '../composition/HumanizationBridge'
import { ScopedEffectBuilder, ScopeEntry } from './ScopedEffectBuilder'
import { KNUTH_MULTIPLIER } from '../constants'

export interface HumanizationParams {
  velocityJitter: number
  timingAmount: number
  rng: SeededRandom | null
  entries: ScopeEntry[]
}

export class HumanizationBuilder extends ScopedEffectBuilder<HumanizationBuilder> {
  private readonly params: Omit<HumanizationParams, 'entries' | 'seed'>

  constructor(params: Partial<HumanizationParams>) {
    super(params.entries ?? [])
    this.params = {
      velocityJitter: params.velocityJitter ?? 0,
      timingAmount: params.timingAmount ?? 0,
      rng: params.rng ?? null,
    }
  }

  velocity(jitter: number): HumanizationBuilder {
    return this.clone({ velocityJitter: jitter })
  }

  timing(amount: number): HumanizationBuilder {
    return this.clone({ timingAmount: amount })
  }

  seed(seed: number): HumanizationBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    const rng = this.params.rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new HumanizationBridge(bridge, { ...this.params, rng })
  }

  protected cloneWithEntries(entries: ScopeEntry[]): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, entries })
  }

  private clone(overrides: Partial<HumanizationParams>): HumanizationBuilder {
    return new HumanizationBuilder({ ...this.params, entries: this.entries, ...overrides })
  }
}
