import { CrescendoBuilder, DecrescendoBuilder } from '../builders/DynamicsBuilders'

export function crescendo(duration: number): CrescendoBuilder {
  return new CrescendoBuilder({ duration })
}

export function decrescendo(duration: number): DecrescendoBuilder {
  return new DecrescendoBuilder({ duration })
}
