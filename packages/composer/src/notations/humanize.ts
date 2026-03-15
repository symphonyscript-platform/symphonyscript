import { SeededRandom } from '@symphonyscript/core'
import { HumanizationBuilder } from '../builders/HumanizationBuilder'

export function humanize(
  velocityJitter?: number,
  timingAmount?: number,
  seed?: number,
): HumanizationBuilder {
  return new HumanizationBuilder({
    velocityJitter,
    timingAmount,
    rng: new SeededRandom(seed ?? Date.now()),
  })
}
