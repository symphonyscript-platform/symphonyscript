import { ClipBuilder } from './ClipBuilder'
import { PipeStep } from './interfaces/pipe-step'

export class Clip {
  static pipe(...steps: PipeStep[]): ClipBuilder {
    return new ClipBuilder({
      prev: null,
      steps,
    })
  }
}
