import { IClip } from '../interfaces/IClip'
import { FrozenClip } from '../interfaces/frozen-clip'

export function freeze(composer: IClip): FrozenClip {
  const bridge = new DefaultCompositionBridge()
  const composed = composer.compose(bridge)
  const recorder = new RecordingBridge()

  composed.commit(recorder)

  return recorder.toFrozenClip()
}
