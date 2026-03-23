import { HashingFunction, HashTable } from './HashTable'
import { fibonacciHash } from './functions'
import { nextPowerOf2 } from '../utils'
import { ERROR_TABLE_FULL, OK } from '../constants'

export class ChainHashTable implements HashTable {
  public readonly totalSizeInBytes: number
  public readonly endByteOffset: number

  private readonly capacity: number
  private readonly shift: number
  private readonly freeHeadByteOffset: number
  private readonly sizeByteOffset: number
  private readonly bucketsByteOffset: number
  private readonly entriesByteOffset: number
  private readonly bucketsRegionSizeInBytes: number
  private readonly entriesRegionSizeInBytes: number
  private readonly entrySizeInBytes = 12

  constructor(
    private readonly sab: Int32Array,
    private readonly startByteOffset: number,
    private readonly maxEntries: number,
    private readonly maxLoadFactor: number = 0.7,
    private readonly hash: HashingFunction = fibonacciHash,
  ) {
    this.capacity = nextPowerOf2(Math.ceil(maxEntries / maxLoadFactor))
    this.shift = 32 - Math.log2(this.capacity)
    this.freeHeadByteOffset = this.startByteOffset
    this.sizeByteOffset = this.startByteOffset + 4
    this.bucketsByteOffset = this.startByteOffset + 8
    this.bucketsRegionSizeInBytes = this.capacity * 4
    this.entriesRegionSizeInBytes = this.maxEntries * 3 * 4
    this.totalSizeInBytes = this.bucketsRegionSizeInBytes + this.entriesRegionSizeInBytes + 8 // +4 for freeHead and +4 for size
    this.endByteOffset = this.startByteOffset + this.totalSizeInBytes

    this.entriesByteOffset = this.bucketsByteOffset + this.bucketsRegionSizeInBytes
    this.initializeEntrySlots()
  }

  static calculateCapacity(maxEntries: number, maxLoadFactor: number) {
    return nextPowerOf2(Math.ceil(maxEntries / maxLoadFactor))
  }

  static bytesRequired(maxEntries: number, maxLoadFactor: number) {
    const capacity = ChainHashTable.calculateCapacity(maxEntries, maxLoadFactor)

    return capacity * 4 + maxEntries * 12 + 8
  }

  get(key: number): number {
    const offset = this.toOffset(key)
    let currentI32 = this.sab[offset >> 2] >> 2

    while (currentI32 !== 0) {
      if (key === this.sab[currentI32]) {
        return this.sab[currentI32 + 1]
      }

      currentI32 = this.sab[currentI32 + 2] >> 2
    }

    return -1
  }

  set(key: number, value: number): number {
    const offset = this.toOffset(key)
    let currentI32 = this.sab[offset >> 2] >> 2

    while (currentI32 !== 0) {
      if (key === this.sab[currentI32]) {
        this.sab[currentI32 + 1] = value
        return OK
      }

      currentI32 = this.sab[currentI32 + 2] >> 2
    }

    const freeHead = this.sab[this.freeHeadByteOffset >> 2]

    if (freeHead === 0) {
      return -ERROR_TABLE_FULL
    }

    const freeHeadI32 = freeHead >> 2
    const oldHead = this.sab[offset >> 2]
    const nextFreeHead = this.sab[freeHeadI32 + 2]
    this.sab[offset >> 2] = freeHead
    this.sab[freeHeadI32] = key
    this.sab[freeHeadI32 + 1] = value
    this.sab[freeHeadI32 + 2] = oldHead
    this.sab[this.freeHeadByteOffset >> 2] = nextFreeHead
    this.sab[this.sizeByteOffset >> 2] += 1

    return OK
  }

  delete(key: number): number {
    const offset = this.toOffset(key)
    const freeHeadI32 = this.freeHeadByteOffset >> 2
    let current = this.sab[offset >> 2]
    let previousI32 = offset >> 2

    while (current !== 0) {
      const currentI32 = current >> 2
      const nextByteOffset = currentI32 + 2

      if (key === this.sab[currentI32]) {
        const value = this.sab[currentI32 + 1]
        this.sab[previousI32] = this.sab[nextByteOffset]
        this.sab[nextByteOffset] = this.sab[freeHeadI32]
        this.sab[freeHeadI32] = current
        this.sab[this.sizeByteOffset >> 2] -= 1

        return value
      }

      previousI32 = currentI32 + 2
      current = this.sab[nextByteOffset]
    }

    return 0
  }

  compact(): void {
  }

  private toOffset(key: number) {
    const index = this.hash(key, this.shift) & (this.capacity - 1)

    return this.bucketsByteOffset + (index * 4)
  }

  private initializeEntrySlots() {
    const entrySize = this.entrySizeInBytes
    const start = this.entriesByteOffset
    const end = start + this.entriesRegionSizeInBytes

    this.sab[this.freeHeadByteOffset >> 2] = this.entriesByteOffset

    for (let byteOffset = start; byteOffset < end; byteOffset += entrySize) {
      if (byteOffset < (end - entrySize)) {
        this.sab[(byteOffset >> 2) + 2] = byteOffset + entrySize
      }
    }
  }
}
