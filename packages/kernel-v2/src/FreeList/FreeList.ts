export interface FreeList {
  readonly totalSizeInBytes: number
  alloc(): number
  free(byteOffset: number): void
}
