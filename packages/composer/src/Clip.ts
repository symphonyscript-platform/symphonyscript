import { IClip } from './interfaces/IClip'
import { PipeStep } from './interfaces/pipe-step'
import { CompositionBridge } from './interfaces/composition-bridge'
import { freeze } from './utils/freeze'
import { IFrozenClip } from './interfaces/frozen-clip'

export class Clip implements IClip {
  constructor(private readonly steps: PipeStep[]) {
  }

  static pipe(...steps: PipeStep[]): Clip {
    return new Clip(steps)
  }

  static freeze(clip: IClip): IFrozenClip {
    return freeze(clip)
  }

  pipe(...steps: PipeStep[]): Clip {
    return new Clip({
      ...this.steps,
      ...steps,
    })
  }

  compose(context: CompositionBridge): CompositionBridge {
    const steps = this.steps
    let bridge = context

    for (let i = 0; i < steps.length; ++i) {
      bridge = steps[i].apply(bridge)
    }

    return bridge
  }
}
