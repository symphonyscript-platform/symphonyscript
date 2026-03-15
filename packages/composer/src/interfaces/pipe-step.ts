import { CompositionBridge } from './composition-bridge'

export interface PipeStep {
  apply(bridge: CompositionBridge): CompositionBridge;
}
