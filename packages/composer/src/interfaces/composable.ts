import type { CompositionBridge } from '@symphonyscript/composer'

export interface Composable {
  compose(bridge: CompositionBridge): CompositionBridge
}
