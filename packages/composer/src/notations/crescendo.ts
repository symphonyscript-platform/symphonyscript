import { DecrescendoBuilder } from '../builders/DecrescendoBuilder'
import { CrescendoBuilder } from '../builders/CrescendoBuilder'

/**
 * Create a {@link CrescendoBuilder} for crescendo: ramps velocity from soft to
 * loud over a duration starting at the current bridge tick.
 *
 * Uses {@link VelocityRampBridge}; ramp spans `duration` ticks from the point
 * where the step is applied. Chain `.steps()` for scoped application or
 * `.default()` to cascade downstream.
 *
 * @param duration - Length of the ramp in ticks. Default 480.

 * @returns Immutable {@link CrescendoBuilder} — chain `.duration()`, `.from()`, `.to()`, `.curve()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * crescendo(960)                           // Ramp over 960 ticks
 * crescendo().from(200).to(1000).steps(...) // Custom velocity range
 * crescendo(480).curve('exponential')      // Exponential rise
 * crescendo().default()                    // Cascades downstream
 * crescendo(240)                           // Short 240-tick crescendo
 * ```
 */
export function crescendo(duration?: number): CrescendoBuilder {
  return new CrescendoBuilder({ duration })
}

/**
 * Create a {@link DecrescendoBuilder} for decrescendo/diminuendo: ramps velocity
 * from loud to soft over a duration starting at the current bridge tick.
 *
 * Uses {@link VelocityRampBridge}; ramp spans `duration` ticks from the point
 * where the step is applied. Chain `.steps()` for scoped application or
 * `.default()` to cascade downstream.
 *
 * @param duration - Length of the diminuendo in ticks. Default 480.

 * @returns Immutable {@link DecrescendoBuilder} — chain `.duration()`, `.from()`, `.to()`, `.curve()`, `.steps()`, `.default()`
 *
 * @example
 * ```ts
 * decrescendo(960)                           // Diminuendo over 960 ticks
 * decrescendo().from(1000).to(200).steps(...)// Custom velocity range
 * decrescendo(480).curve('exponential')     // Exponential fall
 * decrescendo().default()                   // Cascades downstream
 * decrescendo(240)                          // Short 240-tick diminuendo
 * ```
 */
export function decrescendo(duration?: number): DecrescendoBuilder {
  return new DecrescendoBuilder({ duration })
}
