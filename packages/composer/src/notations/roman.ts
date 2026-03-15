import { RomanBuilder } from '../builders/RomanBuilder'
import type { RomanNumeral } from '@symphonyscript/theory'

export function roman(numeral: RomanNumeral, duration?: number): RomanBuilder {
  return new RomanBuilder({ numeral, duration })
}
