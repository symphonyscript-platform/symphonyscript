import { HashingFunction, HashTable } from './HashTable'
import { fibonacciHash } from './functions'
import { nextPowerOf2 } from '../utils'
import { ERROR_TABLE_FULL, OK } from '../constants'

export class ProbeHashTable implements HashTable {
  public readonly totalSizeInBytes: number
  public readonly endByteOffset: number

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
    this.capacity = ProbeHashTable.calculateCapacity(maxEntries, maxLoadFactor)
    this.totalSizeInBytes = ProbeHashTable.bytesRequired(maxEntries, maxLoadFactor)
    this.endByteOffset = this.startByteOffset + this.totalSizeInBytes

    this.shift = 32 - Math.log2(this.capacity)
    this.sizeByteOffset = this.startByteOffset
    this.listStartByteOffset = this.startByteOffset + 4
    this.initializeSlots()
  }

  static calculateCapacity(maxEntries: number, maxLoadFactor: number) {
    return nextPowerOf2(Math.ceil(maxEntries / maxLoadFactor))
  }

  static bytesRequired(maxEntries: number, maxLoadFactor: number) {
    const capacity = ProbeHashTable.calculateCapacity(maxEntries, maxLoadFactor)
    const slotSize = 12

    return capacity * slotSize + 4 // +4 for "size" slot
  }

  get(key: number): number {
    const hash = this.hash(key, this.shift)
    const capacity = this.capacity
    const mod = capacity - 1
    const start = this.listStartByteOffset
    let displacement = 0

    for (let k = 0; k < capacity; ++k) {
      const index = (hash + k) & mod
      const offset = (start >> 2) + index * 3
      const slotKey = this.sab[offset + 1]

      if (slotKey === -1) {
        return -1
      }

      const slotHome = this.sab[offset] & mod
      const slotDisplacement = (index - slotHome) & mod

      if (displacement > slotDisplacement) {
        return -1
      }

      if (key === slotKey) {
        return this.sab[offset + 2]
      }

      ++displacement
    }

    return -1
  }

  set(key: number, value: number): number {
    if (this.sab[this.sizeByteOffset >> 2] >= this.maxEntries) {
      return ERROR_TABLE_FULL
    }

    const capacity = this.capacity
    const mod = capacity - 1
    const start = this.listStartByteOffset
    let hash = this.hash(key, this.shift)
    let displacement = 0

    for (let k = 0; k < capacity; ++k) {
      const index = (hash + k) & mod
      const offset = (start >> 2) + index * 3
      const slotKey = this.sab[offset + 1]

      if (slotKey === -1) {
        this.sab[offset] = hash
        this.sab[offset + 1] = key
        this.sab[offset + 2] = value
        this.sab[this.sizeByteOffset >> 2] += 1

        return OK
      } else if (slotKey === key) {
        this.sab[offset + 2] = value
        return OK
      }

      const slotHash = this.sab[offset]
      const slotHome = slotHash & mod
      const slotDisplacement = (index - slotHome) & mod

      if (displacement > slotDisplacement) {
        const slotValue = this.sab[offset + 2]
        this.sab[offset] = hash
        this.sab[offset + 1] = key
        this.sab[offset + 2] = value
        key = slotKey
        value = slotValue
        hash = slotHash
        displacement = slotDisplacement
      }

      ++displacement
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
      const offset = (start >> 2) + index * 3
      const resolvedKey = this.sab[offset + 1]

      if (key === -1) {
        return -1
      }

      if (key === resolvedKey) {
        const value = this.sab[offset + 1]
        this.sab[offset] = -2
        this.sab[offset + 1] = -2
        this.sab[offset + 2] = -2
        this.sab[this.sizeByteOffset >> 2] -= 1

        return value
      }

      ++k
    }

    return -1
  }

  compact() {

  }

  private backwardsShift(
    deletedKey: number,
    deletedIndex: number,
  ) {
    const capacity = this.capacity

    for (let i = deletedIndex; i < capacity; ++i) {

    }
  }

  private initializeSlots() {
    const end = this.endByteOffset
    this.sab.fill(-1, this.listStartByteOffset >> 2, end >> 2)
    this.sab[this.sizeByteOffset >> 2] = 0
  }
}
