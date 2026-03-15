import type { RomanNumeral } from '@symphonyscript/theory'
import { ProgressionBuilder } from '../builders/ProgressionBuilder'

/** Emit a chord progression from roman numerals. */
export function progression(numerals: RomanNumeral[], duration?: number): ProgressionBuilder {
  return new ProgressionBuilder({ numerals, duration })
}
