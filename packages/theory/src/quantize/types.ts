/** Quantize mode for timing synchronization. */
export type QuantizeMode = 'bar' | 'beat' | 'off'

/** Time signature representation. */
export interface TimeSignature {
  readonly beatsPerMeasure: number
  readonly beatUnit: number
}
