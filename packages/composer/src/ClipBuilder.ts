import { Composer } from './interfaces/composer'
import { PipeStep } from './interfaces/pipe-step'
import { PipeStepNode } from './interfaces/pipe-step-node'
import { CompositionBridge } from './interfaces/composition-bridge'

export class ClipBuilder implements Composer {
  constructor(private readonly tail: PipeStepNode | null = null) {
  }

  pipe(...steps: PipeStep[]): ClipBuilder {
    return new ClipBuilder({
      prev: this.tail,
      steps,
    })
  }

  compose(context: CompositionBridge): CompositionBridge {
    let current = this.tail
    let bridge = context
    const nodes: PipeStepNode[] = []

    while (current) {
      nodes.push(current)
      current = current.prev
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      const steps = nodes[i].steps
      for (let j = 0; j < steps.length; ++j) {
        const step = steps[j]
        bridge = step.apply(bridge)
      }
    }

    return bridge
  }
}
