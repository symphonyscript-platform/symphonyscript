# K-003 Implementation Plan: Lazy Zero-on-Alloc

**Target**: Fix Zone B memory handling to prevent data leakage during SAB reuse ("Dirty Reset").
**Strategy**: "Clean as you Go" (Zero-on-Alloc).
**Scope**: `packages/kernel/src/local-allocator.ts`
**Author**: Antigravity

## 1. Problem Statement
Zone B (Main Thread Heap) is left untouched by `FreeList.initialize`. If an SAB is reused, Zone B may contain stale data.

## 2. Proposed Solution (REVISED)
Instead of bulk-zeroing the entire heap at startup (which causes lag spikes and trusts initialization order), we mandate that **`LocalAllocator` explicitly zeros each node at the moment of allocation.**

**Benefits:**
1.  **Distributed Cost**: Zeroing cost is spread across frames, not front-loaded.
2.  **Zero-Trust**: Allocator guarantees clean nodes regardless of heap state.
3.  **Cache Efficiency**: Writes happen to hot cache lines.

## 3. Implementation Details

### 3.1 LocalAllocator (`local-allocator.ts`)

```typescript
  alloc(): number {
    // ... bump pointer logic ...
    const ptr = this.nextPtr
    this.nextPtr += NODE_SIZE_BYTES
    
    // CLEAN AS YOU GO
    this.zeroNode(ptr)
    
    return ptr
  }

  private zeroNode(ptrBytes: number): void {
    const idx = ptrBytes / 4
    this.sab[idx + 0] = 0 // PACKED_A
    this.sab[idx + 1] = 0 // BASE_TICK
    // ... zero all 8 words ...
  }
```

## 4. Verification Plan

### 4.1 Automated Tests (`initialization-safety.test.ts`)
1.  **Setup**: Create SAB, dirties Zone B with garbage (`0xDEADBEEF`).
2.  **Reset**: Call `resetLinkerSAB`.
3.  **Assert Dirty**: Confirm Zone B is *still* dirty (proving no bulk zeroing).
4.  **Alloc**: Call `alloc()`.
5.  **Assert Clean**: Confirm the *returned pointer* points to fresh, zeroed memory.

## 5. Rollback Strategy
None. This is the optimal strategy.
