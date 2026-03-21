export class SharedFreeList {
  public readonly totalSizeInBytes: number

  private readonly listSizeInBytes: number
  private readonly endByteOffset: number
  private readonly bitmaskStartByteOffset: number

  constructor(
    private readonly sab: Int32Array<ArrayBufferLike>,
    private readonly startByteOffset: number,
    private readonly headByteOffset: number,
    private readonly slotSizeInBytes: number,
    private readonly slotsCount: number,
    private readonly maxRetryCounts: number,
  ) {
    if (startByteOffset % 4 !== 0) throw new Error(`startByteOffset must be evenly divisible by 4, got: ${startByteOffset}`)
    if (headByteOffset % 4 !== 0) throw new Error(`headByteOffset must be evenly divisible by 4, got: ${headByteOffset}`)
    if (slotSizeInBytes % 64 !== 0) throw new Error(`slotSizeInBytes must be evenly divisible by 64, got: ${slotSizeInBytes}`)

    this.listSizeInBytes = this.slotSizeInBytes * this.slotsCount
    this.endByteOffset = startByteOffset + this.listSizeInBytes
    const bitmapSizeInBytes = Math.ceil(this.slotsCount / 32) * 4
    this.totalSizeInBytes = this.listSizeInBytes + bitmapSizeInBytes
    this.bitmaskStartByteOffset = this.endByteOffset

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

      const slotEndByteOffset = headByteOffset + this.slotSizeInBytes

      for (let i = headByteOffset; i < slotEndByteOffset; i += 4) {
        // no Atomics.store needed: the slot is floating,
        // no other thread can read it at this point
        this.sab[i >> 2] = 0
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
    if (byteOffset < this.startByteOffset || byteOffset >= this.endByteOffset) {
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
    const start = this.startByteOffset
    const end = this.endByteOffset
    const slotSize = this.slotSizeInBytes

    Atomics.store(this.sab, this.headByteOffset >> 2, this.startByteOffset)

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
