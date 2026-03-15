import { ExecutionContext } from '@symphonyscript/core'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { CompositionBridge } from '@symphonyscript/composer'
import { ThunkNode } from '../interfaces/thunk-node'

export interface BaseCompositionBridgeParams {
  tick: number
  velocity: number
  transpose: number
  defaultDuration: number
  tempo: number
  timeSignatureNum: number
  timeSignatureDen: number
  scaleRoot: number
  scaleMode: ScaleMode
  swing: number
  muted: boolean
  precise: boolean
  quantizeGrid: number
  quantizeStrength: number
  tail: ThunkNode | null,
  length: number,
}

export class BaseCompositionBridge implements CompositionBridge {
  protected readonly params: BaseCompositionBridgeParams

  constructor(params: Partial<BaseCompositionBridgeParams> = {}) {
    this.params = {
      tick: params.tick ?? 0,
      velocity: params.velocity ?? 800,
      transpose: params.transpose ?? 0,
      defaultDuration: params.defaultDuration ?? 1,
      tempo: params.tempo ?? 120,
      timeSignatureNum: params.timeSignatureNum ?? 4,
      timeSignatureDen: params.timeSignatureDen ?? 4,
      scaleRoot: params.scaleRoot ?? 0,
      scaleMode: params.scaleMode ?? ScaleMode.MAJOR,
      swing: params.swing ?? 0,
      muted: params.muted ?? false,
      precise: params.precise ?? false,
      quantizeGrid: params.quantizeGrid ?? 0,
      quantizeStrength: params.quantizeStrength ?? 1.0,
      tail: params.tail ?? null,
      length: params.length ?? 0,
    }
  }

  get tick() { return this.params.tick }
  get velocity() { return this.params.velocity }
  get transpose() { return this.params.transpose }
  get defaultDuration() { return this.params.defaultDuration }
  get tempo() { return this.params.tempo }
  get timeSignatureNum() { return this.params.timeSignatureNum }
  get timeSignatureDen() { return this.params.timeSignatureDen }
  get scaleRoot() { return this.params.scaleRoot }
  get scaleMode() { return this.params.scaleMode }
  get swing() { return this.params.swing }
  get muted() { return this.params.muted }
  get precise() { return this.params.precise }
  get quantizeGrid() { return this.params.quantizeGrid }
  get quantizeStrength() { return this.params.quantizeStrength }

  withNote(pitch: number, duration?: number, velocity?: number): BaseCompositionBridge {
    const dur = duration ?? this.params.defaultDuration
    const vel = velocity ?? this.params.velocity
    const finalPitch = pitch + this.params.transpose
    const tick = this.params.tick
    const muted = this.params.muted

    return this.derive({ tick: this.params.tick + dur }, ctx => {
      return ctx.insertNote(finalPitch, vel, dur, tick, muted, 0)
    })
  }

  withCC(controller: number, value: number): BaseCompositionBridge {
    const tick = this.params.tick

    return this.derive({}, ctx => ctx.insertCC(controller, value, tick, 0))
  }

  withBend(value: number): BaseCompositionBridge {
    const tick = this.params.tick

    return this.derive({}, ctx => ctx.insertBend(value, tick, 0))
  }

  withConnect(srcId: number, tgtId: number, weight?: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.connect(srcId, tgtId, weight))
  }

  withDisconnect(srcId: number, tgtId: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.disconnect(srcId, tgtId))
  }

  withReclaim(nodePtr: number): BaseCompositionBridge {
    return this.derive({}, ctx => ctx.reclaim(nodePtr))
  }

  withVelocity(v: number): BaseCompositionBridge {
    return this.derive({ velocity: v })
  }

  withTranspose(s: number): BaseCompositionBridge {
    return this.derive({ transpose: s })
  }

  withDefaultDuration(d: number): BaseCompositionBridge {
    return this.derive({ defaultDuration: d })
  }

  withTempo(bpm: number): BaseCompositionBridge {
    return this.derive({ tempo: bpm })
  }

  withTimeSignature(num: number, den: number): BaseCompositionBridge {
    return this.derive({ timeSignatureNum: num, timeSignatureDen: den })
  }

  withScale(root: PitchClass, mode: ScaleMode): BaseCompositionBridge {
    return this.derive({ scaleRoot: root, scaleMode: mode })
  }

  withKey(root: PitchClass, mode: ScaleMode): BaseCompositionBridge {
    return this.derive({ scaleRoot: root, scaleMode: mode })
  }

  withSwing(amount: number): BaseCompositionBridge {
    return this.derive({ swing: amount })
  }

  withQuantize(grid: number, strength?: number): BaseCompositionBridge {
    return this.derive({ quantizeGrid: grid, quantizeStrength: strength ?? 1.0 })
  }

  withTick(tick: number): BaseCompositionBridge {
    return this.derive({ tick })
  }

  withMuted(muted: boolean): BaseCompositionBridge {
    return this.derive({ muted })
  }

  withPrecise(precise: boolean): BaseCompositionBridge {
    return this.derive({ precise })
  }

  commit(context: ExecutionContext): void {
    const thunks: ((ctx: ExecutionContext) => void)[] = []
    let current = this.params.tail

    while (current) {
      thunks.push(current.thunk)
      current = current.prev
    }

    for (let i = thunks.length - 1; i >= 0; --i) {
      thunks[i](context)
    }
  }

  private derive(
    overrides: Partial<BaseCompositionBridgeParams>,
    thunk?: (context: ExecutionContext) => void
  ): BaseCompositionBridge {
    return new BaseCompositionBridge(
      {
        ...this.params,
        ...overrides,
        tail: thunk ? { thunk, prev: this.params.tail } : this.params.tail,
        length: thunk ? this.params.length + 1 : this.params.length,
      },
    )
  }
}
