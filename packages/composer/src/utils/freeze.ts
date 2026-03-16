import { IClip } from '../interfaces/IClip'
import { IFrozenClip } from '../interfaces/frozen-clip'
import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'

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
 * @param composer - Clip to compose and capture (e.g. from {@link note}, {@link chord}, or piped clips).

 * @returns Immutable snapshot of notes, CC events, and bends; use {@link IFrozenClip.visitNotes}
 *   and related visit methods to read data.
 *
 * @example
 * const clip = note('C4').pipe(glide(0.5))
 * const frozen = freeze(clip)
 * frozen.visitNotes((src, pitch, vel, dur, tick, muted) => { ... })
 *
 * @example
 * const frozen = freeze(chord('Am').pipe(reverse()))
 *
 * @example
 * const frozen = freeze(note('E4').duration(2).pipe(expression(80)))
 */
export function freeze(composer: IClip): IFrozenClip {
  const bridge = new BaseCompositionBridge()
  const composed = composer.compose(bridge)
  const recorder = new RecordingBridge()

  composed.commit(recorder)

  return recorder.toFrozenClip()
}
