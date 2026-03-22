export interface FreeList {
  readonly totalSizeInBytes: number
  getFreeCount(): number
  alloc(): number
  free(byteOffset: number): number
  toShared(maxRetries?: number): FreeList
  toLocal(): FreeList
}
