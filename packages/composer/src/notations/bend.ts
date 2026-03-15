import { BendBuilder } from '../builders/BendBuilder'

export function bend(value?: number): BendBuilder {
  return new BendBuilder({ value })
}
