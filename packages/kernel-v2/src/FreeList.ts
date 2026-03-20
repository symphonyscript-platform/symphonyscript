export class FreeList {
  private readonly tailByteOffset: number
  private readonly totalSlotsCount: number

  constructor(
    private readonly sab: Int32Array<ArrayBufferLike>,
    private readonly startByteOffset: number,
    private readonly headByteOffset: number,
    private readonly listSizeInBytes: number,
    private readonly slotSizeInBytes: number,
  ) {
    if (listSizeInBytes % slotSizeInBytes !== 0)
      throw new Error('listSizeInBytes must be evenly divisible by slotSizeInBytes')
    this.tailByteOffset = startByteOffset + listSizeInBytes
    this.totalSlotsCount = Math.floor(listSizeInBytes / slotSizeInBytes)
    this.initializeSlots()
  }

  alloc(): number {
    while (true) {
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
        continue
      }

      const i32CountPerSlot = this.slotSizeInBytes >> 2

      for (let i = 0; i < i32CountPerSlot; ++i) {
        const byteOffset = headByteOffset + i * 4
        Atomics.store(this.sab, byteOffset >> 2, 0)
      }

      return headByteOffset
    }
  }

  free(byteOffset: number): void {
    if (byteOffset < this.startByteOffset || byteOffset >= this.tailByteOffset) {
      return
    }

    while (true) {
      const headByteOffset = Atomics.load(this.sab, this.headByteOffset >> 2)
      Atomics.store(this.sab, byteOffset >> 2, headByteOffset)

      const actualByteOffset = Atomics.compareExchange(
        this.sab,
        this.headByteOffset >> 2,
        headByteOffset,
        byteOffset,
      )

      if (actualByteOffset === headByteOffset) {
        return
      }
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
