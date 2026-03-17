import { IClip } from '../interfaces/IClip'
import { IFrozenClip } from '../interfaces/frozen-clip'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'
import type { Notation } from '@symphonyscript/core'

/**
 * Compose an {@link IClip} and capture its output as an immutable snapshot.
 *
 * **Flow:** compose → commit → toFrozenClip
 *
 * 1. Compose: runs `composer.compose(bridge)` into a default {@link BaseCompositionBridge},
 *    producing a bridge with accumulated notes, CC events, and pitch bends.
 * 2. Commit: flushes the composed bridge's deferred thunks into a {@link RecordingBridge}
 *    (ExecutionContext) via `commit`.
 * 3. toFrozenClip: builds and returns an {@link IFrozenClip} from the captured events.
 *
 * One-shot: the clip is composed and recorded in a single call. Use when you need
 * a read-only snapshot of the clip's output (e.g. for transforms, playback, or export).
 *
 * @param composer - Clip to compose and capture.
 * @param notation - Notation instance for pitch/interval resolution.
 *
 * @returns Immutable snapshot of notes, CC events, and bends.
 *
 * @example
 * const clip = note('C4').pipe(glide(0.5))
 * const frozen = freeze(clip, notation)
 * frozen.visitNotes((src, pitch, vel, dur, tick, muted) => { ... })
 */
export function freeze(composer: IClip, notation: Notation): IFrozenClip {
  const bridge = new BaseCompositionBridge({ notation })
  const composed = composer.compose(bridge)
  const recorder = new RecordingBridge()

  composed.commit(recorder)

  return recorder.toFrozenClip()
}
