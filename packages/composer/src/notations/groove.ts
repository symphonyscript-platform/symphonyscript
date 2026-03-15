import { GrooveBuilder } from '../builders/GrooveBuilder'

export function groove(grid?: number): GrooveBuilder {
  return new GrooveBuilder({ grid })
}
