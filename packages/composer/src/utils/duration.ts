/**
 * Duration types and resolution for string-based note durations.
 *
 * Converts human-readable duration strings ('4n', '8n.', '4t') to tick values
 * at PPQ 480. Numbers pass through unchanged.
 */

/** Standard note durations. */
export type StandardDuration =
  | '1n' | '2n' | '4n' | '8n' | '16n' | '32n'

/** Dotted durations (1.5× standard). */
export type DottedDuration =
  | '1n.' | '2n.' | '4n.' | '8n.' | '16n.'

/** Triplet durations (2/3× standard). */
export type TripletDuration =
  | '2t' | '4t' | '8t' | '16t'

/**
 * Note duration as a string literal or raw tick count.
 *
 * String values are resolved at PPQ 480:
 * - `'4n'` = 480 ticks (quarter note)
 * - `'8n.'` = 360 ticks (dotted eighth)
 * - `'4t'` = 320 ticks (quarter triplet)
 */
export type NoteDuration =
  | StandardDuration
  | DottedDuration
  | TripletDuration
  | number

const DURATION_MAP: Record<string, number> = {
  '1n':  1920,
  '2n':  960,
  '4n':  480,
  '8n':  240,
  '16n': 120,
  '32n': 60,

  '1n.':  2880,  // 1920 × 1.5
  '2n.':  1440,  // 960 × 1.5
  '4n.':  720,   // 480 × 1.5
  '8n.':  360,   // 240 × 1.5
  '16n.': 180,   // 120 × 1.5

  '2t':  640,    // 960 × 2/3
  '4t':  320,    // 480 × 2/3
  '8t':  160,    // 240 × 2/3
  '16t': 80,     // 120 × 2/3
}

/**
 * Resolve a {@link NoteDuration} to a tick count.
 *
 * Numbers pass through unchanged. Strings are looked up from a fixed PPQ 480 table.
 *
 * @param d - Duration as string or number
 * @returns Tick count
 * @throws If string is not a recognized duration
 */
export function resolveDuration(d: NoteDuration): number
export function resolveDuration(d: NoteDuration | undefined): number | undefined
export function resolveDuration(d: NoteDuration | undefined): number | undefined {
  if (d == null) {
    return void 0
  }

  if (typeof d === 'number') {
    return d
  }

  const ticks = DURATION_MAP[d]

  if (ticks === undefined) {
    throw new Error(`Unknown duration string: '${d}'`)
  }

  return ticks
}
