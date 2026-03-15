import { CompositionBridge, PipeStep } from '@symphonyscript/composer'
import { ChanceBridge } from '../composition/ChanceBridge'
import { ScopedEffectBuilder, ScopeEntry } from './ScopedEffectBuilder'

export interface ChanceParams {
  probability: number
  seed: number | null
  entries: ScopeEntry[]
}

export class ChanceBuilder extends ScopedEffectBuilder<ChanceBuilder> {
  private readonly _probability: number
  private readonly _seed: number | null

  constructor(params: Partial<ChanceParams>) {
    super(params.entries ?? [])
    this._probability = params.probability ?? 1
    this._seed = params.seed ?? null
  }

  seed(seed: number): ChanceBuilder {
    return this.clone({ seed })
  }

  probability(probability: number): ChanceBuilder {
    return this.clone({ probability })
  }

  protected wrap(bridge: CompositionBridge): CompositionBridge {
    return new ChanceBridge(bridge, this._probability, this._seed ?? Date.now())
  }

  protected cloneWithEntries(entries: ScopeEntry[]): ChanceBuilder {
    return new ChanceBuilder({ probability: this._probability, seed: this._seed, entries })
  }

  private clone(overrides: Partial<ChanceParams>): ChanceBuilder {
    return new ChanceBuilder({
      probability: this._probability,
      seed: this._seed,
      entries: this.entries,
      ...overrides,
    })
  }
}
