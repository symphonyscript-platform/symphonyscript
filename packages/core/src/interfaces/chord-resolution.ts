import { Cents, ChordIntervals } from '../types'

export interface ChordResolution {
  readonly rootCents: Cents
  readonly intervals: ChordIntervals
}
