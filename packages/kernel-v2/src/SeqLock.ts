export class SeqLock {
  constructor(private readonly sab: Int32Array) {
  }

  writeStart(byteOffset: number) {
    Atomics.add(this.sab, byteOffset >> 2, 1)
  }

  writeEnd(byteOffset: number) {
    Atomics.add(this.sab, byteOffset >> 2, 1)
  }

  readStart(byteOffset: number) {
    return Atomics.load(this.sab, byteOffset >> 2)
  }

  readValidate(byteOffset: number, seq: number) {
    if ((seq & 1) !== 0) return false
    return Atomics.load(this.sab, byteOffset >> 2) === seq
  }
}
