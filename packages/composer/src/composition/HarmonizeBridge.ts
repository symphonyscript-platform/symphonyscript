import { CompositionBridge } from '@symphonyscript/composer'
import { degreeToPitch, ScaleMode } from '@symphonyscript/theory'
import { CompositionBridgeDecorator } from './CompositionBridgeDecorator'

export interface HarmonizeBridgeParams {
  intervals: readonly number[]  // diatonic intervals to add (e.g., [3, 5] for third + fifth)
}

export class HarmonizeBridge extends CompositionBridgeDecorator {
  constructor(
    bridge: CompositionBridge,
    private readonly params: HarmonizeBridgeParams,
  ) {
    super(bridge)
  }

  override withNote(pitch: number, duration?: number, velocity?: number): CompositionBridge {
    if (this.precise) return this.rewrap(this.bridge.withNote(pitch, duration, velocity))

    let target = this.bridge.withNote(pitch, duration, velocity)

    const scaleMode = this.scaleMode as ScaleMode
    const scaleRoot = this.scaleRoot

    // For each harmony interval, resolve the diatonic offset and emit
    for (let i = 0; i < this.params.intervals.length; ++i) {
      const interval = this.params.intervals[i]

      // Find the original note's scale degree by brute-force search
      const originalDegree = this.findScaleDegree(pitch, scaleRoot, scaleMode)
      if (originalDegree === null) continue

      const harmonizedPitch = degreeToPitch(
        originalDegree + interval - 1,
        scaleRoot,
        scaleMode,
        Math.floor(pitch / 12) - 1,
      )

      if (harmonizedPitch === null) continue

      target = target
        .withTick(this.tick)
        .withNote(harmonizedPitch, duration, velocity)
    }

    return this.rewrap(target)
  }

  protected rewrap(bridge: CompositionBridge): HarmonizeBridge {
    return new HarmonizeBridge(bridge, this.params)
  }

  private findScaleDegree(pitch: number, scaleRoot: number, scaleMode: ScaleMode): number | null {
    // Search degrees 1-14 (two octaves) to find which degree matches this pitch
    for (let degree = 1; degree <= 14; ++degree) {
      const degreePitch = degreeToPitch(
        degree,
        scaleRoot,
        scaleMode,
        Math.floor(pitch / 12) - 1,
      )

      if (degreePitch === pitch) return degree
    }

    return null
  }
}
