import type { PipeStep } from '@symphonyscript/composer'
import { RepeatBuilder } from '../builders/RepeatBuilder'

/** Repeat a step n times sequentially. */
export function repeat(count: number, source: PipeStep): RepeatBuilder {
  return new RepeatBuilder({ count, source })
}
