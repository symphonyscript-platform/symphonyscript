import { ExecutionContext } from '@symphonyscript/core'

export interface ThunkNode {
  readonly thunk: (context: ExecutionContext) => void
  readonly prev: ThunkNode | null
}
