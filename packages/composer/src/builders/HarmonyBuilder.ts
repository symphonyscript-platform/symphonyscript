import { CompositionBridge } from '@symphonyscript/composer'
import { getScaleIntervals } from '@symphonyscript/theory'
import type { HarmonyMask } from '@symphonyscript/theory'
import { PitchStepBuilder, PitchStepParams } from './PitchStepBuilder'

export interface HarmonyParams extends PitchStepParams {
  mask: HarmonyMask
  root: number
}

export class HarmonyBuilder extends PitchStepBuilder<HarmonyBuilder> {
  private readonly mask: HarmonyMask
  private readonly root: number

  constructor(params: Partial<HarmonyParams> & { mask: HarmonyMask }) {
    super(params)
    this.mask = params.mask
    this.root = params.root ?? 60
  }

  protected create(params: Partial<PitchStepParams>): HarmonyBuilder {
    return new HarmonyBuilder({ ...params, mask: this.mask, root: this.root })
  }

  apply(bridge: CompositionBridge): CompositionBridge {
    const intervals = getScaleIntervals(this.mask)

    if (intervals.length === 0) return bridge

    let target = this.applyFlags(bridge)


    const scaledDuration = this.resolvedDuration()
    const resolvedRoot = this.root
      + this.shared.accidental
      + (this.shared.octaveShift * 12)
      + this.shared.transposeSemitones

    for (let repeat = 0; repeat < this.shared.repeatCount; ++repeat) {
      const repeatStartTick = target.tick

      for (let i = 0; i < intervals.length; ++i) {
        const pitch = resolvedRoot + Math.floor(Number(intervals[i]) / 2)

        target = target
          .withTick(repeatStartTick)
          .withNote(pitch, scaledDuration, this.shared.velocity ?? undefined)
      }

      // Advance tick past this chord
      const advanceDuration = scaledDuration ?? bridge.defaultDuration
      target = target.withTick(repeatStartTick + advanceDuration)
    }

    return this.resetFlags(target)
  }
}
