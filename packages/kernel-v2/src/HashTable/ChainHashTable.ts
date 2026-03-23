import { HashingFunction, HashTable } from './HashTable'
import { fibonacciHash } from './functions'
import { nextPowerOf2 } from '../utils'
import { ERROR_TABLE_FULL, OK } from '../constants'

export class ChainHashTable implements HashTable {
  public readonly totalSizeInBytes: number
  public readonly endByteOffset: number

  private readonly capacity: number
  private readonly mod: number
  private readonly shift: number
  private readonly startIndex: number
  private readonly freeHeadIndex: number
  private readonly sizeIndex: number
  private readonly bucketsStartIndex: number
  private readonly entriesStartIndex: number
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
    this.mod = this.capacity - 1
    this.shift = 32 - Math.log2(this.capacity)
    this.startIndex = this.startByteOffset >> 2
    this.freeHeadIndex = this.startIndex
    this.sizeIndex = this.startIndex + 1
    this.bucketsStartIndex = this.startIndex + 2
    this.bucketsRegionSizeInBytes = this.capacity * 4
    this.entriesRegionSizeInBytes = this.maxEntries * 3 * 4
    this.totalSizeInBytes = this.bucketsRegionSizeInBytes + this.entriesRegionSizeInBytes + 8 // +4 for freeHead and +4 for size
    this.endByteOffset = this.startByteOffset + this.totalSizeInBytes

    this.entriesStartIndex = this.bucketsStartIndex + (this.bucketsRegionSizeInBytes >> 2)
    this.initializeSlots()
  }

  static calculateCapacity(maxEntries: number, maxLoadFactor: number) {
    return nextPowerOf2(Math.ceil(maxEntries / maxLoadFactor))
  }

  static bytesRequired(maxEntries: number, maxLoadFactor: number) {
    const capacity = ChainHashTable.calculateCapacity(maxEntries, maxLoadFactor)

    return capacity * 4 + maxEntries * 12 + 8
  }

  get(key: number): number {
    const hashMod = this.hash(key, this.shift) & this.mod
    const bucketIndex = this.bucketsStartIndex + hashMod
    let entryIndex = this.sab[bucketIndex] >> 2

    while (entryIndex !== 0) {
      if (key === this.sab[entryIndex]) {
        return this.sab[entryIndex + 1]
      }

      entryIndex = this.sab[entryIndex + 2] >> 2
    }

    return -1
  }

  set(key: number, value: number): number {
    const hashMod = this.hash(key, this.shift) & this.mod
    const bucketIndex = this.bucketsStartIndex + hashMod
    let entryIndex = this.sab[bucketIndex] >> 2

    while (entryIndex !== 0) {
      if (key === this.sab[entryIndex]) {
        this.sab[entryIndex + 1] = value
        return OK
      }

      entryIndex = this.sab[entryIndex + 2] >> 2
    }

    const freeHeadOffset = this.sab[this.freeHeadIndex]

    if (freeHeadOffset === 0) {
      return -ERROR_TABLE_FULL
    }

    const freeHeadIndex = freeHeadOffset >> 2
    const oldHead = this.sab[bucketIndex]
    const nextFreeHead = this.sab[freeHeadIndex + 2]
    this.sab[bucketIndex] = freeHeadOffset
    this.sab[freeHeadIndex] = key
    this.sab[freeHeadIndex + 1] = value
    this.sab[freeHeadIndex + 2] = oldHead
    this.sab[this.freeHeadIndex] = nextFreeHead
    this.sab[this.sizeIndex] += 1

    return OK
  }

  delete(key: number): number {
    const hashMod = this.hash(key, this.shift) & this.mod
    const bucketIndex = this.bucketsStartIndex + hashMod
    const freeHeadIndex = this.freeHeadIndex
    let entryOffset = this.sab[bucketIndex]
    let previousEntryIndex = bucketIndex

    while (entryOffset !== 0) {
      const entryIndex = entryOffset >> 2
      const nextPointerIndex = entryIndex + 2

      if (key === this.sab[entryIndex]) {
        const value = this.sab[entryIndex + 1]
        this.sab[previousEntryIndex] = this.sab[nextPointerIndex]
        this.sab[nextPointerIndex] = this.sab[freeHeadIndex]
        this.sab[freeHeadIndex] = entryOffset
        this.sab[entryIndex] = 0
        this.sab[entryIndex + 1] = 0
        this.sab[entryIndex + 2] = 0
        this.sab[this.sizeIndex] -= 1

        return value
      }

      previousEntryIndex = entryIndex + 2
      entryOffset = this.sab[nextPointerIndex]
    }

    return -1
  }

  compact(): void {
  }

  private initializeSlots() {
    const entrySize = this.entrySizeInBytes
    const start = this.entriesStartIndex << 2
    const end = start + this.entriesRegionSizeInBytes

    this.sab[this.freeHeadIndex] = start

    for (let byteOffset = start; byteOffset < end; byteOffset += entrySize) {
      if (byteOffset < (end - entrySize)) {
        this.sab[(byteOffset >> 2) + 2] = byteOffset + entrySize
      } else {
        this.sab[(byteOffset >> 2) + 2] = 0
      }
    }

    this.sab.fill(
      0,
      this.bucketsStartIndex,
      this.bucketsStartIndex + (this.bucketsRegionSizeInBytes >> 2),
    )
  }
}
