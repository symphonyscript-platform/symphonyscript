import { ERROR_BUFFER_SIZE_MISMATCH, ERROR_RING_BUFFER_EMPTY, ERROR_RING_BUFFER_OVERFLOW, OK } from './constants'

export class RingBuffer {
  public readonly totalSizeInBytes: number

  private readonly listStartByteOffset: number
  private readonly listSizeInBytes: number
  private readonly listSizeInBytesMod: number
  private readonly readByteOffsetRel: number
  private readonly writeByteOffsetRel: number
  private readonly pendingByteOffset: number

  constructor(
    private readonly sab: Int32Array,
    startByteOffset: number,
    private readonly slotSizeInBytes: number,
    private readonly slotsCount: number,
  ) {
    if (startByteOffset % 4 !== 0) throw new Error(`startByteOffset must be evenly divisible by 4, got: ${startByteOffset}`)
    if (slotSizeInBytes % 64 !== 0) throw new Error(`slotSizeInBytes must be evenly divisible by 64, got: ${slotSizeInBytes}`)
    if ((slotsCount & (slotsCount - 1)) !== 0) throw new Error(`slotsCount must be power of 2, got: ${slotsCount}`)

    this.readByteOffsetRel = startByteOffset
    this.writeByteOffsetRel = startByteOffset + 4
    this.pendingByteOffset = startByteOffset + 8
    this.listStartByteOffset = startByteOffset + 12
    this.listSizeInBytes = slotSizeInBytes * slotsCount
    this.listSizeInBytesMod = this.listSizeInBytes - 1
    this.totalSizeInBytes = this.listSizeInBytes + 12

    this.sab[this.readByteOffsetRel >> 2] = 0
    this.sab[this.writeByteOffsetRel >> 2] = 0
    this.sab[this.pendingByteOffset >> 2] = 0
  }

  getPendingCount() {
    return Atomics.load(this.sab, this.pendingByteOffset >> 2)
  }

  read(outputBuffer: Int32Array): number {
    if (outputBuffer.byteLength !== this.slotSizeInBytes) {
      return -ERROR_BUFFER_SIZE_MISMATCH
    }

    const pending = Atomics.load(this.sab, this.pendingByteOffset >> 2)

    if (pending === 0) {
      return -ERROR_RING_BUFFER_EMPTY
    }

    const relativeOffset = this.sab[this.readByteOffsetRel >> 2]
    const absoluteOffset = this.listStartByteOffset + relativeOffset

    for (let i = 0; i < this.slotSizeInBytes; i += 4) {
      outputBuffer[i >> 2] = this.sab[(absoluteOffset + i) >> 2]
    }

    this.sab[this.readByteOffsetRel >> 2] = (relativeOffset + this.slotSizeInBytes) & this.listSizeInBytesMod
    Atomics.sub(this.sab, this.pendingByteOffset >> 2, 1)

    return OK
  }

  write(inputBuffer: Int32Array): number {
    if (inputBuffer.byteLength !== this.slotSizeInBytes) {
      return -ERROR_BUFFER_SIZE_MISMATCH
    }

    const pending = Atomics.load(this.sab, this.pendingByteOffset >> 2)

    if (pending >= this.slotsCount) {
      return -ERROR_RING_BUFFER_OVERFLOW
    }

    const relativeOffset = this.sab[this.writeByteOffsetRel >> 2]
    const absoluteOffset = this.listStartByteOffset + relativeOffset

    for (let i = 0; i < this.slotSizeInBytes; i += 4) {
      this.sab[(absoluteOffset + i) >> 2] = inputBuffer[i >> 2]
    }

    this.sab[this.writeByteOffsetRel >> 2] = (relativeOffset + this.slotSizeInBytes) & this.listSizeInBytesMod
    Atomics.add(this.sab, this.pendingByteOffset >> 2, 1)

    return OK
  }
}
