export interface HashTable {
  readonly totalSizeInBytes: number
  get(key: number): number
  set(key: number, value: number): number
  delete(key: number): number
  compact(): void
}

export type HashingFunction = (key: number, shift: number) => number
