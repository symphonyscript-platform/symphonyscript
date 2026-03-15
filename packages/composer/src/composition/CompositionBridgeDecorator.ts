import { CompositionBridge } from '@symphonyscript/composer'
import { ExecutionContext } from '@symphonyscript/core'
import { PitchClass, ScaleMode } from '@symphonyscript/theory'

export abstract class CompositionBridgeDecorator implements CompositionBridge {
  constructor(protected readonly bridge: CompositionBridge) {}

  get tick() { return this.bridge.tick }
  get velocity() { return this.bridge.velocity }
  get transpose() { return this.bridge.transpose }
  get defaultDuration() { return this.bridge.defaultDuration }
  get tempo() { return this.bridge.tempo }
  get timeSignatureNum() { return this.bridge.timeSignatureNum }
  get timeSignatureDen() { return this.bridge.timeSignatureDen }
  get scaleRoot() { return this.bridge.scaleRoot }
  get scaleMode() { return this.bridge.scaleMode }
  get keyRoot() { return this.bridge.keyRoot }
  get keyMode() { return this.bridge.keyMode }
  get volume() { return this.bridge.volume }
  get pan() { return this.bridge.pan }
  get swing() { return this.bridge.swing }
  get muted() { return this.bridge.muted }
  get precise() { return this.bridge.precise }
  get quantizeGrid() { return this.bridge.quantizeGrid }
  get quantizeStrength() { return this.bridge.quantizeStrength }

  withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    return this.rewrap(this.bridge.withNote(pitch, duration, velocity))
  }

  withCC(controller: number, value: number): CompositionBridge {
    return this.rewrap(this.bridge.withCC(controller, value))
  }

  withBend(value: number): CompositionBridge {
    return this.rewrap(this.bridge.withBend(value))
  }

  withAftertouch(value: number, pitch?: number): CompositionBridge {
    return this.rewrap(this.bridge.withAftertouch(value, pitch))
  }

  withConnect(srcId: number, tgtId: number, weight?: number): CompositionBridge {
    return this.rewrap(this.bridge.withConnect(srcId, tgtId, weight))
  }

  withDisconnect(srcId: number, tgtId: number): CompositionBridge {
    return this.rewrap(this.bridge.withDisconnect(srcId, tgtId))
  }

  withReclaim(nodePtr: number): CompositionBridge {
    return this.rewrap(this.bridge.withReclaim(nodePtr))
  }

  // === Delegated state modifiers — rewrap ===
  withVelocity(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withVelocity(v))
  }

  withTranspose(s: number): CompositionBridge {
    return this.rewrap(this.bridge.withTranspose(s))
  }

  withDefaultDuration(d: number): CompositionBridge {
    return this.rewrap(this.bridge.withDefaultDuration(d))
  }

  withTempo(bpm: number): CompositionBridge {
    return this.rewrap(this.bridge.withTempo(bpm))
  }

  withTimeSignature(num: number, den: number): CompositionBridge {
    return this.rewrap(this.bridge.withTimeSignature(num, den))
  }

  withScale(root: PitchClass, mode: ScaleMode): CompositionBridge {
    return this.rewrap(this.bridge.withScale(root, mode))
  }

  withKey(root: PitchClass, mode: ScaleMode): CompositionBridge {
    return this.rewrap(this.bridge.withKey(root, mode))
  }

  withSwing(amount: number): CompositionBridge {
    return this.rewrap(this.bridge.withSwing(amount))
  }

  withVolume(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withVolume(v))
  }

  withPan(v: number): CompositionBridge {
    return this.rewrap(this.bridge.withPan(v))
  }

  withQuantize(grid: number, strength?: number): CompositionBridge {
    return this.rewrap(this.bridge.withQuantize(grid, strength))
  }

  withTick(tick: number): CompositionBridge {
    return this.rewrap(this.bridge.withTick(tick))
  }

  withMuted(muted: boolean): CompositionBridge {
    return this.rewrap(this.bridge.withMuted(muted))
  }

  withPrecise(precise: boolean): CompositionBridge {
    return this.rewrap(this.bridge.withPrecise(precise))
  }

  commit(ctx: ExecutionContext) {
    this.bridge.commit(ctx)
  }

  protected abstract rewrap(bridge: CompositionBridge): CompositionBridgeDecorator
}
