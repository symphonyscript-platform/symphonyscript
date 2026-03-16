import { ExecutionContext } from '@symphonyscript/core'

/**
 * Immutable linked list node for deferred execution.
 * Used by {@link BaseCompositionBridge} to store thunks in a tail-first chain;
 * each node holds a callback and a reference to the previous node.
 */
export interface ThunkNode {
  /** Function to run later with the composition context. */
  readonly thunk: (context: ExecutionContext) => void
  /** Previous node in the chain, or null if this is the head. */
  readonly prev: ThunkNode | null
}
