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
      const slotNumber = (hash + k) & mod
      const slotIndex = (start >> 2) + slotNumber * 3
      const slotKey = this.sab[slotIndex + 1]

      if (slotKey === -1) {
        return -1
      }

      const slotHome = this.sab[slotIndex] & mod
      const slotDisplacement = (slotNumber - slotHome) & mod

      if (displacement > slotDisplacement) {
        return -1
      }

      if (key === slotKey) {
        return this.sab[slotIndex + 2]
      }

      ++displacement
    }

    return -1
  }

  set(key: number, value: number): number {
    if (this.sab[this.sizeByteOffset >> 2] >= this.maxEntries) {
      return -ERROR_TABLE_FULL
    }

    const capacity = this.capacity
    const mod = capacity - 1
    const start = this.listStartByteOffset
    let hash = this.hash(key, this.shift)
    let displacement = 0

    for (let k = 0; k < capacity; ++k) {
      const slotNumber = (hash + k) & mod
      const slotIndex = (start >> 2) + slotNumber * 3
      const slotKey = this.sab[slotIndex + 1]

      if (slotKey === -1) {
        this.sab[slotIndex] = hash
        this.sab[slotIndex + 1] = key
        this.sab[slotIndex + 2] = value
        this.sab[this.sizeByteOffset >> 2] += 1

        return OK
      } else if (slotKey === key) {
        this.sab[slotIndex + 2] = value
        return OK
      }

      const slotHash = this.sab[slotIndex]
      const slotHome = slotHash & mod
      const slotDisplacement = (slotNumber - slotHome) & mod

      // Robin Hood eviction: the incoming element is more displaced than the occupant,
      // so it claims this slot. The evicted occupant inherits the current loop position
      // and continues probing forward from here with its own hash and displacement.
      if (displacement > slotDisplacement) {
        const slotValue = this.sab[slotIndex + 2]
        this.sab[slotIndex] = hash
        this.sab[slotIndex + 1] = key
        this.sab[slotIndex + 2] = value
        key = slotKey
        value = slotValue
        hash = slotHash
        displacement = slotDisplacement
      }

      ++displacement
    }

    return -ERROR_TABLE_FULL
  }

  delete(key: number): number {
    const hash = this.hash(key, this.shift)
    const capacity = this.capacity
    const mod = capacity - 1
    const start = this.listStartByteOffset
    let displacement = 0

    for (let k = 0; k < capacity; ++k) {
      const slotNumber = (hash + k) & mod
      const slotIndex = (start >> 2) + slotNumber * 3
      const slotKey = this.sab[slotIndex + 1]

      if (slotKey === -1) {
        return -1
      }

      const slotHome = this.sab[slotIndex] & mod
      const slotDisplacement = (slotNumber - slotHome) & mod

      if (displacement > slotDisplacement) {
        return -1
      }

      if (key === slotKey) {
        const value = this.sab[slotIndex + 2]
        this.sab[slotIndex] = -1
        this.sab[slotIndex + 1] = -1
        this.sab[slotIndex + 2] = -1
        this.sab[this.sizeByteOffset >> 2] -= 1
        this.backwardsShift(slotNumber)

        return value
      }

      ++displacement
    }

    return -1
  }

  compact() {

  }

  private backwardsShift(emptiedSlotNumber: number) {
    const capacity = this.capacity
    const mod = capacity - 1
    const start = this.listStartByteOffset
    const startSlotNumber = emptiedSlotNumber + 1
    let lastEmptiedSlotIndex = (start >> 2) + emptiedSlotNumber * 3

    for (let i = 0; i < capacity; ++i) {
      const slotNumber = (startSlotNumber + i) & mod
      const slotIndex = (start >> 2) + slotNumber * 3
      const slotHash = this.sab[slotIndex]
      const slotKey = this.sab[slotIndex + 1]

      if (slotKey === -1) {
        break
      }

      const slotHome = slotHash & mod
      const slotDisplacement = (slotNumber - slotHome) & mod;

      if (slotDisplacement > 0) {
        this.sab[lastEmptiedSlotIndex] = slotHash
        this.sab[lastEmptiedSlotIndex + 1] = slotKey
        this.sab[lastEmptiedSlotIndex + 2] = this.sab[slotIndex + 2]
        this.sab[slotIndex] = -1
        this.sab[slotIndex + 1] = -1
        this.sab[slotIndex + 2] = -1
        lastEmptiedSlotIndex = slotIndex
      } else {
        break
      }
    }
  }

  private initializeSlots() {
    const end = this.endByteOffset
    this.sab.fill(-1, this.listStartByteOffset >> 2, end >> 2)
    this.sab[this.sizeByteOffset >> 2] = 0
  }
}
