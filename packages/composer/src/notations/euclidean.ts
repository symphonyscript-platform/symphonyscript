import { EuclideanBuilder } from '../builders/EuclideanBuilder'

export function euclidean(hits?: number, steps?: number): EuclideanBuilder {
  return new EuclideanBuilder({ hits, steps })
}
