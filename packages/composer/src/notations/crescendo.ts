import { DecrescendoBuilder } from '../builders/DecrescendoBuilder'
import { CrescendoBuilder } from '../builders/CrescendoBuilder'

export function crescendo(duration?: number): CrescendoBuilder {
  return new CrescendoBuilder({ duration })
}

export function decrescendo(duration?: number): DecrescendoBuilder {
  return new DecrescendoBuilder({ duration })
}
