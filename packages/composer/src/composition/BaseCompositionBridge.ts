import { ExecutionContext } from '@symphonyscript/core'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'
import { CompositionBridge } from '@symphonyscript/composer'
import { ThunkNode } from '../interfaces/thunk-node'

interface BridgeState {
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
}
export class BaseCompositionBridge implements CompositionBridge {
  constructor(
    readonly tick: number = 0,
    readonly velocity: number = 800,
    readonly transpose: number = 0,
    readonly defaultDuration: number = 1,
    readonly tempo: number = 120,
    readonly timeSignatureNum: number = 4,
    readonly timeSignatureDen: number = 4,
    readonly scaleRoot: number = 0,
    readonly scaleMode: ScaleMode = ScaleMode.MAJOR,
    readonly swing: number = 0,
    readonly muted: boolean = false,
    readonly precise: boolean = false,
    readonly quantizeGrid: number = 0,
    readonly quantizeStrength: number = 1.0,

    private readonly tail: ThunkNode | null = null,
    private readonly length: number = 0,
  ) {}

  withNote(pitch: number, duration?: number, velocity?: number): BaseCompositionBridge {
    const dur = duration ?? this.defaultDuration
    const vel = velocity ?? this.velocity
    const finalPitch = pitch + this.transpose
    const tick = this.tick

    return this.derive({ tick: this.tick + dur }, ctx => {
      return ctx.insertNote(finalPitch, vel, dur, tick, false, 0)
    })
  }

  withCC(controller: number, value: number): BaseCompositionBridge {
    const tick = this.tick

    return this.derive({}, ctx => ctx.insertCC(controller, value, tick, 0))
  }

  withBend(value: number): BaseCompositionBridge {
    const tick = this.tick

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
    let current = this.tail

    while (current) {
      thunks.push(current.thunk)
      current = current.prev
    }

    for (let i = thunks.length - 1; i >= 0; --i) {
      thunks[i](context)
    }
  }

  private derive(
    overrides: Partial<BridgeState>,
    thunk?: (context: ExecutionContext) => void
  ): BaseCompositionBridge {
    return new BaseCompositionBridge(
      overrides.tick ?? this.tick,
      overrides.velocity ?? this.velocity,
      overrides.transpose ?? this.transpose,
      overrides.defaultDuration ?? this.defaultDuration,
      overrides.tempo ?? this.tempo,
      overrides.timeSignatureNum ?? this.timeSignatureNum,
      overrides.timeSignatureDen ?? this.timeSignatureDen,
      overrides.scaleRoot ?? this.scaleRoot,
      overrides.scaleMode ?? this.scaleMode,
      overrides.swing ?? this.swing,
      overrides.muted ?? this.muted,
      overrides.precise ?? this.precise,
      overrides.quantizeGrid ?? this.quantizeGrid,
      overrides.quantizeStrength ?? this.quantizeStrength,
      thunk ? { thunk, prev: this.tail } : this.tail,
      thunk ? this.length + 1 : this.length,
    )
  }
}
