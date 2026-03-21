import { FreeList } from './FreeList'
import { SharedFreeList } from './SharedFreeList'

export class LocalFreeList implements FreeList {
  public readonly totalSizeInBytes: number

  private readonly headSlotByteOffset: number
  private readonly listSizeInBytes: number
  private readonly endByteOffset: number
  private readonly bitmapSizeInBytes: number
  private readonly bitmaskStartByteOffset: number

  private constructor(
    private readonly sab: Int32Array,
    private readonly startByteOffset: number,
    private readonly slotSizeInBytes: number,
    private readonly slotsCount: number,
    bind: boolean = false,
  ) {
    if (startByteOffset % 4 !== 0) throw new Error(`startByteOffset must be evenly divisible by 4, got: ${startByteOffset}`)
    if (slotSizeInBytes % 64 !== 0) throw new Error(`slotSizeInBytes must be evenly divisible by 64, got: ${slotSizeInBytes}`)

    this.listSizeInBytes = this.slotSizeInBytes * this.slotsCount
    this.endByteOffset = this.startByteOffset + this.listSizeInBytes
    this.headSlotByteOffset = this.endByteOffset
    this.bitmaskStartByteOffset = this.endByteOffset + 4

    this.bitmapSizeInBytes = Math.ceil(this.slotsCount / 32) * 4
    this.totalSizeInBytes = this.listSizeInBytes + this.bitmapSizeInBytes + 4 // +4 is for the head slot
    if (!bind) this.initializeSlots()
  }

  static create(
    sab: Int32Array<ArrayBufferLike>,
    startByteOffset: number,
    slotSizeInBytes: number,
    slotsCount: number,
  ) {
    return new LocalFreeList(
      sab,
      startByteOffset,
      slotSizeInBytes,
      slotsCount,
      false,
    )
  }

  static bind(
    sab: Int32Array<ArrayBufferLike>,
    startByteOffset: number,
    slotSizeInBytes: number,
    slotsCount: number,
  ) {
    return new LocalFreeList(
      sab,
      startByteOffset,
      slotSizeInBytes,
      slotsCount,
      true,
    )
  }

  toLocal(): FreeList {
    return this
  }

  toShared(maxRetries?: number): FreeList {
    return SharedFreeList.bind(
      this.sab,
      this.startByteOffset,
      this.slotSizeInBytes,
      this.slotsCount,
      maxRetries,
    )
  }

  alloc(): number {
    const slotByteOffset = this.sab[this.headSlotByteOffset >> 2]

    if (slotByteOffset === 0) return 0

    const slotEndByteOffset = slotByteOffset + this.slotSizeInBytes
    const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
    const slotBitmaskOffset = (this.bitmaskStartByteOffset >> 2) + (slotBitmaskIndex >> 5)

    this.sab[this.headSlotByteOffset >> 2] = this.sab[slotByteOffset >> 2]
    this.sab[slotBitmaskOffset] |= 1 << (slotBitmaskIndex & 31)

    for (let i = slotByteOffset; i < slotEndByteOffset; i += 4) {
      this.sab[i >> 2] = 0
    }

    return slotByteOffset
  }

  free(slotByteOffset: number) {
    if (slotByteOffset < this.startByteOffset || slotByteOffset >= this.endByteOffset) return

    const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
    const slotBitmaskOffset = (this.bitmaskStartByteOffset >> 2) + (slotBitmaskIndex >> 5)
    const isFreed = (this.sab[slotBitmaskOffset] & (1 << (slotBitmaskIndex & 31))) === 0

    if (isFreed) return

    this.sab[slotByteOffset >> 2] = this.sab[this.headSlotByteOffset >> 2]
    this.sab[this.headSlotByteOffset >> 2] = slotByteOffset
    this.sab[slotBitmaskOffset] &= ~(1 << (slotBitmaskIndex & 31))
  }

  private initializeSlots() {
    const start = this.startByteOffset
    const end = this.endByteOffset
    const slotSize = this.slotSizeInBytes

    this.sab[this.headSlotByteOffset >> 2] = start

    for (let b = start; b < end; b += slotSize) {
      const next = b + slotSize
      this.sab[b >> 2] = next < end ? next : 0
    }
  }
}
