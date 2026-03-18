/**
 * Duration types for the composition API.
 *
 * Duration resolution is deferred to apply-time via the notation's
 * `durationToTicks()` method. The composer layer never interprets
 * duration strings — it only stores them and passes them through.
 */

import type { DurationName } from '@symphonyscript/core'

/**
 * Note duration as a notation duration name or raw tick count.
 *
 * String values (e.g. `'4n'`, `'quarter'`, `'8n.'`) are resolved
 * at apply-time via `bridge.notation().durationToTicks(name, ppq)`.
 * Numbers pass through unchanged as raw tick values.
 */
export type NoteDuration = DurationName | number
