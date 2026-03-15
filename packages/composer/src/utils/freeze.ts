import { IClip } from '../interfaces/IClip'
import { IFrozenClip } from '../interfaces/frozen-clip'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'

export function freeze(composer: IClip): IFrozenClip {
  const bridge = new BaseCompositionBridge()
  const composed = composer.compose(bridge)
  const recorder = new RecordingBridge()

  composed.commit(recorder)

  return recorder.toFrozenClip()
}
