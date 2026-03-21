export interface FreeList {
  readonly totalSizeInBytes: number
  alloc(): number
  free(byteOffset: number): void
  toShared(maxRetries?: number): FreeList
  toLocal(): FreeList
}
