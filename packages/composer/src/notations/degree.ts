import { DegreeBuilder } from '../builders/DegreeBuilder'

export function degree(degree?: number, duration?: number): DegreeBuilder {
  return new DegreeBuilder({ degree, duration })
}
