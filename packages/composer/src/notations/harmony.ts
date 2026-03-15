import { HarmonyBuilder } from '../builders/HarmonyBuilder'
import type { HarmonyMask } from '@symphonyscript/theory'
import type { NotePitch } from '../types'
import { resolvePitch } from '../utils/pitch'

export function harmony(
  mask?: HarmonyMask,
  root?: NotePitch,
  duration?: number,
): HarmonyBuilder {
  const rootPitch = root !== undefined ? resolvePitch(root) : undefined

  return new HarmonyBuilder({ mask, root: rootPitch, duration })
}
