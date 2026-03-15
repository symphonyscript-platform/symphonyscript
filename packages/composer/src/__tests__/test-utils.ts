/**
 * Test utilities for the Composition API.
 *
 * Pattern:
 *   1. Create a bridge:         const bridge = createBridge({ velocity: 600 })
 *   2. Apply steps:             const result = note('C4').apply(bridge)
 *   3. Capture committed output: const { notes, cc, bends } = commitAndCapture(result)
 *   4. Assert on captured data:  expect(notes[0].pitch).toBe(60)
 */

import { BaseCompositionBridge } from '../composition/BaseCompositionBridge'
import type { BaseCompositionBridgeParams } from '../composition/BaseCompositionBridge'
import { RecordingBridge } from '../composition/RecordingBridge'
import type { RecordedNote, RecordedCC, RecordedBend } from '../interfaces/recorded-events'
import { CompositionBridge } from '../interfaces/composition-bridge'

// ============================================================================
// Bridge Factory
// ============================================================================

/**
 * Create a fresh BaseCompositionBridge with optional overrides.
 *
 * Defaults match BaseCompositionBridge defaults:
 *   tick=0, velocity=800, transpose=0, defaultDuration=1,
 *   tempo=120, timeSignature=4/4, scaleRoot=0(C), scaleMode=MAJOR,
 *   keyRoot=null, volume=100, pan=64, swing=0
 */
export function createBridge(
  overrides: Partial<BaseCompositionBridgeParams> = {},
): BaseCompositionBridge {
  return new BaseCompositionBridge(overrides)
}

// ============================================================================
// Commit + Capture
// ============================================================================

export interface CapturedOutput {
  notes: RecordedNote[]
  cc: RecordedCC[]
  bends: RecordedBend[]
}

/**
 * Commit a composed bridge to a RecordingBridge and return captured events.
 *
 * This is the canonical way to inspect what a composition pipeline produced.
 * Notes, CC events, and pitch bends are captured in emission order.
 */
export function commitAndCapture(bridge: CompositionBridge): CapturedOutput {
  const recorder = new RecordingBridge()
  bridge.commit(recorder)

  const notes: RecordedNote[] = []
  const cc: RecordedCC[] = []
  const bends: RecordedBend[] = []

  const frozen = recorder.toFrozenClip()

  frozen.visitNotes((sourceId, pitch, velocity, duration, tick, muted) => {
    notes.push({ sourceId, pitch, velocity, duration, tick, muted })
  })

  frozen.visitCC((sourceId, controller, value, tick) => {
    cc.push({ sourceId, controller, value, tick })
  })

  frozen.visitBends((sourceId, value, tick) => {
    bends.push({ sourceId, value, tick })
  })

  return { notes, cc, bends }
}
