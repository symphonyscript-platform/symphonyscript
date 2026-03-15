import type { PipeStep } from '@symphonyscript/composer'
import { ScopedBuilder } from '../builders/ScopedBuilder'

/** Compose multiple effects into one scoped block. */
export function scoped(...effects: PipeStep[]): ScopedBuilder {
  return new ScopedBuilder({ effects })
}
