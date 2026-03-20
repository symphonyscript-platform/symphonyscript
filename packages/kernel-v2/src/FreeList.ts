export class FreeList {
  public readonly totalSizeInBytes: number

  private readonly tailByteOffset: number
  private readonly totalSlotsCount: number
  private readonly i32CountPerSlot: number
  private readonly bitmaskStartByteOffset: number

  constructor(
    private readonly sab: Int32Array<ArrayBufferLike>,
    private readonly startByteOffset: number,
    private readonly headByteOffset: number,
    private readonly listSizeInBytes: number,
    private readonly slotSizeInBytes: number,
    private readonly maxRetryCounts: number,
  ) {
    if (startByteOffset % 4 !== 0)
      throw new Error(`startByteOffset must be evenly divisible by 4, got: ${startByteOffset}`)

    if (headByteOffset % 4 !== 0)
      throw new Error(`headByteOffset must be evenly divisible by 4, got: ${headByteOffset}`)

    if (slotSizeInBytes % 4 !== 0)
      throw new Error(`slotSizeInBytes must be evenly divisible by 4, got: ${slotSizeInBytes}`)

    if (listSizeInBytes % slotSizeInBytes !== 0)
      throw new Error(`listSizeInBytes must be evenly divisible by slotSizeInBytes, got: ${listSizeInBytes} / ${slotSizeInBytes}`)

    this.tailByteOffset = startByteOffset + listSizeInBytes
    this.totalSlotsCount = listSizeInBytes / slotSizeInBytes
    this.i32CountPerSlot = slotSizeInBytes >> 2
    const bitmapSizeInBytes = Math.ceil(this.totalSlotsCount / 32) * 4
    this.totalSizeInBytes = listSizeInBytes + bitmapSizeInBytes
    this.bitmaskStartByteOffset = this.tailByteOffset

    this.initializeSlots()
  }

  alloc(): number {
    let retryCount = 0
    while (retryCount < this.maxRetryCounts) {
      const headByteOffset = Atomics.load(this.sab, this.headByteOffset >> 2)

      if (headByteOffset === 0) {
        return 0
      }

      const nextHeadOffset = Atomics.load(this.sab, headByteOffset >> 2)

      const actualHeadByteOffset = Atomics.compareExchange(
        this.sab,
        this.headByteOffset >> 2,
        headByteOffset,
        nextHeadOffset,
      )

      if (actualHeadByteOffset !== headByteOffset) {
        ++retryCount
        continue
      }

      for (let i = 0; i < this.i32CountPerSlot; ++i) {
        const byteOffset = headByteOffset + i * 4
        // no Atomics.store needed: the slot is floating,
        // no other thread can read it at this point
        this.sab[byteOffset >> 2] = 0
      }

      const N = (headByteOffset - this.startByteOffset) / this.slotSizeInBytes
      Atomics.or(
        this.sab,
        (this.bitmaskStartByteOffset >> 2) + (N >> 5),
        (1 << (N & 31)),
      )

      return headByteOffset
    }

    return 0
  }

  free(byteOffset: number): void {
    if (byteOffset < this.startByteOffset || byteOffset >= this.tailByteOffset) {
      console.warn(`Out-of-bounds byte offset ${byteOffset} passed to free(), returning early.`)
      return
    }

    const N = (byteOffset - this.startByteOffset) / this.slotSizeInBytes
    const mask = 1 << (N & 31)
    const isAllocated = Atomics.load(
      this.sab,
      (this.bitmaskStartByteOffset >> 2) + (N >> 5),
    ) & mask

    if (!isAllocated) {
      return
    }

    let retryCount = 0
    while (retryCount < this.maxRetryCounts) {
      const headByteOffset = Atomics.load(this.sab, this.headByteOffset >> 2)
      Atomics.store(this.sab, byteOffset >> 2, headByteOffset)

      const actualByteOffset = Atomics.compareExchange(
        this.sab,
        this.headByteOffset >> 2,
        headByteOffset,
        byteOffset,
      )

      if (actualByteOffset === headByteOffset) {
        Atomics.and(
          this.sab,
          (this.bitmaskStartByteOffset >> 2) + (N >> 5),
          ~mask,
        )

        return
      }

      ++retryCount
    }
  }

  private initializeSlots() {
    Atomics.store(this.sab, this.headByteOffset >> 2, this.startByteOffset)

    for (let i = 0; i < this.totalSlotsCount; ++i) {
      const byteOffset = this.startByteOffset + i * this.slotSizeInBytes
      const nextByteOffset = byteOffset + this.slotSizeInBytes

      if (nextByteOffset < this.tailByteOffset) {
        Atomics.store(this.sab, byteOffset >> 2, nextByteOffset)
      } else {
        Atomics.store(this.sab, byteOffset >> 2, 0)
      }
    }
  }
}
