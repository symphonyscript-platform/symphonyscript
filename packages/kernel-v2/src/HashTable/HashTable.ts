export interface HashTable {
  readonly totalSizeInBytes: number
  readonly endByteOffset: number

  get(key: number): number
  set(key: number, value: number): number
  delete(key: number): number
}

export type HashingFunction = (key: number, shift: number) => number
