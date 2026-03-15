import { IClip } from '../interfaces/IClip'
import { FrozenClip } from '../interfaces/frozen-clip'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'

export function freeze(composer: IClip): FrozenClip {
  const bridge = new BaseCompositionBridge({})
  const composed = composer.compose(bridge)
  const recorder = new RecordingBridge()

  composed.commit(recorder)

  return recorder.toFrozenClip()
}
