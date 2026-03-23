import { HashingFunction, HashTable } from './HashTable'
import { fibonacciHash } from './functions'
import { nextPowerOf2 } from '../utils'
import { ERROR_TABLE_FULL, OK } from '../constants'

export class ProbeHashTable implements HashTable {
  public readonly totalSizeInBytes: number

  private readonly capacity: number
  private readonly shift: number
  private readonly sizeByteOffset: number
  private readonly listStartByteOffset: number

  constructor(
    private readonly sab: Int32Array,
    private readonly startByteOffset: number,
    private readonly maxEntries: number,
    private readonly maxLoadFactor: number = 0.5,
    private readonly hash: HashingFunction = fibonacciHash,
  ) {
    this.capacity = nextPowerOf2(Math.ceil(maxEntries / maxLoadFactor))
    this.shift = 32 - Math.log2(this.capacity)
    this.sizeByteOffset = this.startByteOffset
    this.listStartByteOffset = this.startByteOffset + 4
    this.totalSizeInBytes = this.maxEntries * 8 + 4 // +4 for size
    this.initializeSlots()
  }

  get(key: number): number {
    const hash = this.hash(key, this.shift)
    const capacity = this.capacity
    const start = this.listStartByteOffset

    for (let k = 0; k < capacity; ++k) {
      const probe = k * (k + 1) / 2
      const index = (hash + probe) & (capacity - 1)
      const offset = (start >> 2) + index
      const resolvedKey = this.sab[offset]

      if (resolvedKey === -1) {
        return -1
      }

      if (key === resolvedKey) {
        return this.sab[offset + 1]
      }

      ++k
    }

    return -1
  }

  set(key: number, value: number): number {
    const hash = this.hash(key, this.shift)
    const capacity = this.capacity
    const start = this.listStartByteOffset
    let firstTombstoneOffset = -1

    for (let k = 0; k < capacity; ++k) {
      const probe = k * (k + 1) / 2
      const index = (hash + probe) & (capacity - 1)
      const offset = (start >> 2) + index
      const resolvedKey = this.sab[offset]

      if (resolvedKey === -1) {
        const resolvedOffset = firstTombstoneOffset === -1
          ? offset
          : firstTombstoneOffset
        this.sab[resolvedOffset] = key
        this.sab[resolvedOffset + 1] = value
        this.sab[this.sizeByteOffset >> 2] += 1

        return OK
      } else if (resolvedKey === -2 && firstTombstoneOffset === -1) {
        firstTombstoneOffset = index
        return OK
      } else if (resolvedKey === key) {
        this.sab[offset + 1] = value
        return OK
      }
    }

    return ERROR_TABLE_FULL
  }

  delete(key: number): number {
    const hash = this.hash(key, this.shift)
    const capacity = this.capacity
    const start = this.listStartByteOffset

    for (let k = 0; k < capacity; ++k) {
      const probe = k * (k + 1) / 2
      const index = (hash + probe) & (capacity - 1)
      const offset = (start >> 2) + index
      const resolvedKey = this.sab[offset]

      if (key === -1) {
        return -1
      }

      if (key === resolvedKey) {
        const value = this.sab[offset + 1]
        this.sab[offset] = -2
        this.sab[offset + 1] = -2
        this.sab[this.sizeByteOffset >> 2] -= 1

        return value
      }

      ++k
    }

    return -1
  }

  compact() {

  }

  private initializeSlots() {
    const end = this.listStartByteOffset + this.maxEntries * 8
    this.sab.fill(-1, this.listStartByteOffset, end)
    this.sab[this.sizeByteOffset >> 2] = 0
  }
}
