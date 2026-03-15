import { EuclideanBuilder } from '../builders/EuclideanBuilder'
import type { NotePitch } from '../types'

export function euclidean(hits?: number, steps?: number): EuclideanBuilder {
  return new EuclideanBuilder({ hits, steps })
}
