import { DynamicsBuilder } from '../builders/DynamicsBuilder'

export function dynamics(
  startVelocity?: number, // velocity at start tick
  endVelocity?: number,   // velocity at end tick
  startTick?: number,     // range start
  endTick?: number,       // range end
): DynamicsBuilder {
  return new DynamicsBuilder({
    startVelocity,
    endVelocity,
    startTick,
    endTick,
  })
}
