# Task 060: Implement Kernel Backpressure

**Priority:** CRITICAL  
**Category:** Kernel Safety  
**Status:** Open  
**Created:** 2026-02-08  
**Source:** Composer & Kernel Remediation Plan

---

## Problem

`SiliconBridge.insertAsync` silently drops commands when `RingBuffer` is full, causing:
1. Data loss (notes never reach Audio Thread)
2. Memory leaks (allocated nodes never freed)

Current buffer size (1,024) is too small for burst composition.

## Current State

```typescript
// silicon-bridge.ts
insertAsync(...): number {
    const ptr = this.localAllocator.alloc();
    // ... populate node ...
    this.ringBuffer.write(CMD.INSERT, ptr, prevPtr); // ❌ Return value ignored!
    return ptr;
}
```

## Required Implementation

### 1. Increase Ring Buffer Capacity

```typescript
// constants.ts
export const COMMAND = {
    DEFAULT_RING_SIZE_BYTES: 1048576, // 65536 * 16 = 1MB
    DEFAULT_RING_CAPACITY: 65536,
};
```

### 2. Implement Spin-Wait in SiliconBridge

```typescript
// silicon-bridge.ts
private writeOrSpin(cmd: number, ptr: number, prev: number): void {
    const MAX_SPIN_MS = 500;
    const startTime = performance.now();
    
    while (true) {
        const result = this.ringBuffer.write(cmd, ptr, prev);
        if (result === RING_ERR.OK) return;
        
        // Wake up Audio Thread
        Atomics.notify(this.sab, HDR.YIELD_SLOT, 1);
        
        // Check timeout
        if (performance.now() - startTime > MAX_SPIN_MS) {
            throw new Error('KERNEL_PANIC: Ring buffer timeout - Audio Thread unresponsive');
        }
        
        // Spin (busy-wait)
    }
}

insertAsync(...): number {
    // ... allocate and populate ...
    this.writeOrSpin(CMD.INSERT, ptr, prevPtr);
    return ptr;
}
```

## Files to Modify

- `[MODIFY] packages/kernel/src/constants.ts`
- `[MODIFY] packages/kernel/src/silicon-bridge.ts`
- `[MODIFY] packages/kernel/src/init.ts` (if capacity is passed to RingBuffer)

## Dependencies

- **None** (This task should be done first - safety critical)

## Acceptance Criteria

- [ ] Ring Buffer capacity is 65,536 entries
- [ ] `insertAsync` blocks (spins) when buffer full
- [ ] Timeout after 500ms throws `KERNEL_PANIC`
- [ ] All `*Async` methods (`connectAsync`, `disconnectAsync`, `deleteAsync`) use `writeOrSpin`
- [ ] No silent command drops under any condition
- [ ] `pnpm build && pnpm test` passes
