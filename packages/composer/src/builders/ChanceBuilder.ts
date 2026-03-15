import { CompositionBridge } from '@symphonyscript/composer'
import { SeededRandom } from '@symphonyscript/core'
import { ChanceBridge } from '../composition/ChanceBridge'
import { ScopedStepBuilder } from './ScopedStepBuilder'
import { CompositionBridgeDecorator } from '../composition/CompositionBridgeDecorator'
import type { PipeStep } from '@symphonyscript/composer'
import { KNUTH_MULTIPLIER } from '../constants'

export interface ChanceParams {
  probability: number
  rng: SeededRandom | null
  entries: PipeStep[][]
}

export class ChanceBuilder extends ScopedStepBuilder<ChanceBuilder> {
  private readonly _probability: number
  private readonly _rng: SeededRandom | null

  constructor(params: Partial<ChanceParams>) {
    super(params.entries ?? [])
    this._probability = params.probability ?? 1
    this._rng = params.rng ?? null
  }

  seed(seed: number): ChanceBuilder {
    return this.clone({ rng: new SeededRandom(seed) })
  }

  probability(probability: number): ChanceBuilder {
    return this.clone({ probability })
  }

  protected onEnter(bridge: CompositionBridge): CompositionBridge {
    const rng = this._rng ?? new SeededRandom((bridge.tick * KNUTH_MULTIPLIER) | 0)

    return new ChanceBridge(bridge, this._probability, rng)
  }

  protected onExit(result: CompositionBridge, _parent: CompositionBridge): CompositionBridge {
    return (result as CompositionBridgeDecorator).unwrap()
  }

  protected cloneWithEntries(entries: PipeStep[][]): ChanceBuilder {
    return new ChanceBuilder({ probability: this._probability, rng: this._rng, entries })
  }

  private clone(overrides: Partial<ChanceParams>): ChanceBuilder {
    return new ChanceBuilder({
      probability: this._probability,
      rng: this._rng,
      entries: this.entries,
      ...overrides,
    })
  }
}
