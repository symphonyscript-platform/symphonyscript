import { RomanBuilder } from '../builders/RomanBuilder'

export function roman(numeral: string, duration?: number): RomanBuilder {
  return new RomanBuilder({ numeral, duration })
}
