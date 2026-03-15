import { CompositionBridge, PipeStep } from '@symphonyscript/composer'

export function step(apply: (bridge: CompositionBridge) => CompositionBridge): PipeStep {
  return { apply };
}
