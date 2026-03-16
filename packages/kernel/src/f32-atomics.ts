// =============================================================================
// SymphonyScript - Atomic Float32 Utilities (RFC-060)
// =============================================================================
// Provides atomic read/write for float32 values stored in Int32Array-backed
// SharedArrayBuffer. Uses scratch buffer reinterpretation (float32 ↔ int32)
// to leverage Atomics.store/Atomics.load which only support Int32Array.
//
// Module-level scratch buffers are safe: JS is single-threaded, so these
// functions can never interrupt each other mid-execution.

const _f32 = new Float32Array(1)
const _i32 = new Int32Array(_f32.buffer)

/**
 * Atomically store a float32 value into a SharedArrayBuffer via Int32Array view.
 *
 * Reinterprets the float32 as int32 via a shared scratch buffer, then uses
 * `Atomics.store` for release semantics on all architectures (including ARM).
 *
 * @param sab - Int32Array view on the SharedArrayBuffer
 * @param index - i32 index within the SAB
 * @param value - Float32 value to store (e.g. cents from C0)
 */
export function atomicStoreF32(sab: Int32Array, index: number, value: number): void {
  _f32[0] = value
  Atomics.store(sab, index, _i32[0])
}

/**
 * Atomically load a float32 value from a SharedArrayBuffer via Int32Array view.
 *
 * Uses `Atomics.load` for acquire semantics, then reinterprets the int32
 * as float32 via a shared scratch buffer.
 *
 * @param sab - Int32Array view on the SharedArrayBuffer
 * @param index - i32 index within the SAB
 * @returns Float32 value at the given index
 */
export function atomicLoadF32(sab: Int32Array, index: number): number {
  _i32[0] = Atomics.load(sab, index)
  return _f32[0]
}
