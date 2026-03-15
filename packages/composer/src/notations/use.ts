import type { CompositionBridge } from '@symphonyscript/composer'
import { PipeStep } from '@symphonyscript/composer'
import { Composable } from '../interfaces/composable'

/** Insert another clip's content at the current tick. */
export function use(clip: Composable): PipeStep {
  return {
    apply(bridge: CompositionBridge): CompositionBridge {
      return clip.compose(bridge)
    },
  }
}
