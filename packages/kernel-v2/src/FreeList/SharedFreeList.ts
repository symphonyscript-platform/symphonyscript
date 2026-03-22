import { FreeList } from './FreeList'
import { LocalFreeList } from './LocalFreeList'
import {
  ERROR_ALIGNMENT_VIOLATION,
  ERROR_CONTENTION_EXCEEDED,
  ERROR_DOUBLE_FREE,
  ERROR_FREE_LIST_CORRUPT,
  ERROR_OUT_OF_BOUNDS,
  OK
} from '../constants'

export class SharedFreeList implements FreeList {
  public readonly totalSizeInBytes: number

  private readonly headSlotByteOffset: number
  private readonly freeCountByteOffset: number
  private readonly listSizeInBytes: number
  private readonly endByteOffset: number
  private readonly bitmapSizeInBytes: number
  private readonly bitmaskStartByteOffset: number

  private constructor(
    private readonly sab: Int32Array<ArrayBufferLike>,
    private readonly startByteOffset: number,
    private readonly slotSizeInBytes: number,
    private readonly slotsCount: number,
    private readonly maxRetryCounts: number = 3,
    bind: boolean = false,
  ) {
    if (startByteOffset % 4 !== 0) throw new Error(`startByteOffset must be evenly divisible by 4, got: ${startByteOffset}`)
    if (slotSizeInBytes % 64 !== 0) throw new Error(`slotSizeInBytes must be evenly divisible by 64, got: ${slotSizeInBytes}`)

    this.listSizeInBytes = this.slotSizeInBytes * this.slotsCount
    this.endByteOffset = startByteOffset + this.listSizeInBytes
    this.headSlotByteOffset = this.endByteOffset
    this.freeCountByteOffset = this.endByteOffset + 4
    this.bitmaskStartByteOffset = this.endByteOffset + 4 + 4

    this.bitmapSizeInBytes = Math.ceil(this.slotsCount / 32) * 4
    this.totalSizeInBytes = this.listSizeInBytes + this.bitmapSizeInBytes + 4 + 4 // +4 is for the head slot and +4 for the freeCount
    if (!bind) this.initializeSlots()
  }

  static create(
    sab: Int32Array<ArrayBufferLike>,
    startByteOffset: number,
    slotSizeInBytes: number,
    slotsCount: number,
    maxRetryCounts: number = 3,
  ) {
    return new SharedFreeList(
      sab,
      startByteOffset,
      slotSizeInBytes,
      slotsCount,
      maxRetryCounts,
      false,
    )
  }

  static bind(
    sab: Int32Array<ArrayBufferLike>,
    startByteOffset: number,
    slotSizeInBytes: number,
    slotsCount: number,
    maxRetryCounts: number = 3,
  ) {
    return new SharedFreeList(
      sab,
      startByteOffset,
      slotSizeInBytes,
      slotsCount,
      maxRetryCounts,
      true,
    )
  }

  toLocal(): FreeList {
    return LocalFreeList.bind(
      this.sab,
      this.startByteOffset,
      this.slotSizeInBytes,
      this.slotsCount,
    )
  }

  toShared(maxRetries?: number): FreeList {
    if (!maxRetries || this.maxRetryCounts === maxRetries) return this

    return SharedFreeList.bind(
      this.sab,
      this.startByteOffset,
      this.slotSizeInBytes,
      this.slotsCount,
      maxRetries,
    )
  }

  getFreeCount() {
    return Atomics.load(this.sab, this.freeCountByteOffset >> 2)
  }

  alloc(): number {
    let retryCount = 0
    while (retryCount < this.maxRetryCounts) {
      const slotByteOffset = Atomics.load(this.sab, this.headSlotByteOffset >> 2)

      if (slotByteOffset === 0) {
        return 0
      }

      if (slotByteOffset < this.startByteOffset || slotByteOffset >= this.endByteOffset) {
        return -ERROR_FREE_LIST_CORRUPT
      }

      const nextHeadOffset = Atomics.load(this.sab, slotByteOffset >> 2)

      const actualHeadByteOffset = Atomics.compareExchange(
        this.sab,
        this.headSlotByteOffset >> 2,
        slotByteOffset,
        nextHeadOffset,
      )

      if (actualHeadByteOffset !== slotByteOffset) {
        ++retryCount
        continue
      }

      const slotEndByteOffset = slotByteOffset + this.slotSizeInBytes

      for (let i = slotByteOffset; i < slotEndByteOffset; i += 4) {
        // no Atomics.store needed: the slot is floating,
        // no other thread can read it at this point
        this.sab[i >> 2] = 0
      }

      const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
      const slotBitmask = 1 << (slotBitmaskIndex & 31)
      const slotBitmaskOffset = (this.bitmaskStartByteOffset >> 2) + (slotBitmaskIndex >> 5)

      Atomics.or(this.sab, slotBitmaskOffset, slotBitmask)
      Atomics.sub(this.sab, this.freeCountByteOffset >> 2, 1)

      return slotByteOffset
    }

    return -ERROR_CONTENTION_EXCEEDED
  }

  free(slotByteOffset: number): number {
    if (slotByteOffset < this.startByteOffset || slotByteOffset >= this.endByteOffset) {
      return -ERROR_OUT_OF_BOUNDS
    }

    if ((slotByteOffset - this.startByteOffset) % this.slotSizeInBytes !== 0) {
      return -ERROR_ALIGNMENT_VIOLATION
    }

    const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
    const slotBitmaskOffset = (this.bitmaskStartByteOffset >> 2) + (slotBitmaskIndex >> 5)
    const slotBitmask = 1 << (slotBitmaskIndex & 31)
    const isFreed = (Atomics.load(this.sab, slotBitmaskOffset) & slotBitmask) === 0

    if (isFreed) {
      return -ERROR_DOUBLE_FREE
    }

    let retryCount = 0
    while (retryCount < this.maxRetryCounts) {
      const headByteOffset = Atomics.load(this.sab, this.headSlotByteOffset >> 2)
      Atomics.store(this.sab, slotByteOffset >> 2, headByteOffset)

      const actualByteOffset = Atomics.compareExchange(
        this.sab,
        this.headSlotByteOffset >> 2,
        headByteOffset,
        slotByteOffset,
      )

      if (actualByteOffset === headByteOffset) {
        Atomics.and(this.sab, slotBitmaskOffset, ~slotBitmask)
        Atomics.add(this.sab, this.freeCountByteOffset >> 2, 1)

        return OK
      }

      ++retryCount
    }

    return -ERROR_CONTENTION_EXCEEDED
  }

  private initializeSlots() {
    const start = this.startByteOffset
    const end = this.endByteOffset
    const slotSize = this.slotSizeInBytes

    Atomics.store(this.sab, this.headSlotByteOffset >> 2, this.startByteOffset)
    Atomics.store(this.sab, this.freeCountByteOffset >> 2, this.slotsCount)

    for (let b = start; b < end; b += slotSize) {
      const next = b + slotSize

      if (next < end) {
        Atomics.store(this.sab, b >> 2, next)
      } else {
        Atomics.store(this.sab, b >> 2, 0)
      }
    }
  }
}
