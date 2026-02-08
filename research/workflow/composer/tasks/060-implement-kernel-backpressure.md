# Task 060: Implement Kernel Backpressure

## Goal
Make `SiliconBridge.insertAsync` safe for high-throughput generation by implementing backpressure.
1. Increase Ring Buffer capacity to **65,536** (1MB) to absorb bursts.
2. Implement **Spin-Wait** in `write()`: if full, spin (block) until space is available or timeout.

## Proposed APIs / Data Structures
### `packages/kernel/src/constants.ts`
- Update `DEFAULT_RING_SIZE_BYTES` to `1048576` (65536 * 16).
- Update `COMMAND.DEFAULT_RING_SIZE_BYTES`.

### `packages/kernel/src/ring-buffer.ts`
- `write()` currently checks `if (full) return ERROR`.
- **Change**: `write()` should NOT spin. It should return specific error code `RING_ERR.FULL`.
- *Correction*: The spin logic belongs in `SiliconBridge`, not `RingBuffer` (separation of concerns). `RingBuffer` is a low-level primitive.

### `packages/kernel/src/silicon-bridge.ts`
- `insertAsync()`:
    - Loop verification of `ringBuffer.write()`.
    - If `RING_ERR.FULL`:
        - `Atomics.notify(sab, HDR.YIELD_SLOT, 1)` (wake up worker if sleeping).
        - Spin-wait loop (check `ringBuffer.isFull()` repeatedly).
        - **Timeout**: If blocked > 100ms (audio thread dead?), throw `KERNEL_PANIC`.

## Implementation Steps
1.  **Modify Constants**: Increase buffer size to 64k commands.
2.  **Update Bridge**: Implement `writeOrSpin` helper method in `SiliconBridge`.
3.  **Refactor**: Update `insertAsync`, `connectAsync`, `disconnectAsync`, `deleteAsync` to use `writeOrSpin`.

## Acceptance Criteria
- [ ] Ring Buffer capacity is 65,536.
- [ ] `SiliconBridge` blocks (spins) instead of dropping commands when full.
- [ ] `SiliconBridge` throws Panic if timed out (deadlock protection).
