import type { NotePitch } from '../types'
import { AftertouchBuilder } from '../builders/AftertouchBuilder'

/**
 * Aftertouch (pressure) at current tick.
 * Omit note for channel aftertouch, provide note for poly aftertouch.
 */
export function aftertouch(value: number, note?: NotePitch): AftertouchBuilder {
  return new AftertouchBuilder({ value, note: note ?? null })
}
