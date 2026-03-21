import { FreeList } from './FreeList'

export class LocalFreeList implements FreeList {
  public readonly totalSizeInBytes: number

  private headByteOffset: number
  private readonly endByteOffset: number
  private readonly bitmaskSizeInBytes: number

  constructor(
    private readonly sab: Int32Array,
    private readonly startByteOffset: number,
    private readonly listSizeInBytes: number,
    private readonly slotSizeInBytes: number,
  ) {
    if (this.startByteOffset % 4 !== 0) throw new Error(`startByteOffset must be evenly divisible by 4: ${startByteOffset}`)
    if (this.listSizeInBytes % 4 !== 0) throw new Error(`listSizeInBytes must be evenly divisible by 4: ${listSizeInBytes}`)
    if (this.slotSizeInBytes % 64 !== 0) throw new Error(`slotSizeInBytes must be evenly divisible by 64: ${slotSizeInBytes}`)
    if (this.listSizeInBytes % this.slotSizeInBytes !== 0) throw new Error(`listSizeInBytes must be evenly divisible by slotSizeInBytes: ${listSizeInBytes} / ${slotSizeInBytes}`)

    this.headByteOffset = this.startByteOffset
    this.endByteOffset = this.startByteOffset + this.listSizeInBytes
    this.bitmaskSizeInBytes = Math.ceil((this.listSizeInBytes / this.slotSizeInBytes) / 32) * 4
    this.totalSizeInBytes = this.listSizeInBytes + this.bitmaskSizeInBytes
    this.initializeSlots()
  }

  alloc(): number {
    if (this.headByteOffset === 0) return 0

    const slotByteOffset = this.headByteOffset
    const slotEndByteOffset = slotByteOffset + this.slotSizeInBytes
    const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
    const slotBitmaskOffset = (this.endByteOffset >> 2) + (slotBitmaskIndex >> 5)

    this.headByteOffset = this.sab[slotByteOffset >> 2]
    this.sab[slotBitmaskOffset] |= 1 << (slotBitmaskIndex & 31)

    for (let i = slotByteOffset; i < slotEndByteOffset; i += 4) {
      this.sab[i >> 2] = 0
    }

    return slotByteOffset
  }

  free(slotByteOffset: number) {
    if (slotByteOffset < this.startByteOffset || slotByteOffset >= this.endByteOffset) return

    const slotBitmaskIndex = (slotByteOffset - this.startByteOffset) / this.slotSizeInBytes
    const slotBitmaskOffset = (this.endByteOffset >> 2) + (slotBitmaskIndex >> 5)
    const isFreed = (this.sab[slotBitmaskOffset] & (1 << (slotBitmaskIndex & 31))) === 0

    if (isFreed) return

    this.sab[slotByteOffset >> 2] = this.headByteOffset
    this.headByteOffset = slotByteOffset
    this.sab[slotBitmaskOffset] &= ~(1 << (slotBitmaskIndex & 31))
  }

  private initializeSlots() {
    const start = this.startByteOffset
    const end = this.endByteOffset
    const slotSize = this.slotSizeInBytes

    for (let b = start; b < end; b += slotSize) {
      const next = b + slotSize
      this.sab[b >> 2] = next < end ? next : 0
    }
  }
}
