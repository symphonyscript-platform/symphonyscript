# Synaptic Remediation Plan

**Date**: 2026-01-30  
**Audit Reference**: `research/audit/2026-01-30-001/synaptic-audit.md`  
**Priority**: CRITICAL → HIGH → MEDIUM → LOW

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 1.0 | 2026-01-30 | Initial remediation plan |
| 1.1 | 2026-01-30 | **Architect Feedback:** (1) Downgraded STATE-002 from HIGH to LOW after kernel verification - `disconnect()` uses pointer values for hash lookup, node existence irrelevant. (2) Added allocation note to KERNEL-004 clarifying `queueMicrotask` closure is acceptable on main thread. |

---

## Priority 1: CRITICAL (Must Fix Before Release)

### KERNEL-001: connect() Failure Silently Ignored [CRITICAL]

**Issue**: `bridge.connect()` return value ignored at line 41. If synapse table is full, `linkTo()` silently fails.

**Risk**: User believes topology is connected, but synapses don't exist. Neural playback breaks silently.

**Fix Location**: `packages/synaptic/src/SynapticNode.ts:33-43`

**Current Code**:
```typescript
linkTo(target: SynapticNode, weight?: number, jitter?: number): this {
    if (this.exitId === undefined) {
        throw new Error('Cannot link: source node has no exit ID (topology not established)');
    }

    const targetEntry = target.getEntryId();

    // RFC-054: Use flat arguments for zero-allocation
    this.bridge.connect(this.exitId, targetEntry, weight, jitter);
    return this;
}
```

**Fix**:
```typescript
linkTo(target: SynapticNode, weight?: number, jitter?: number): this {
    if (this.exitId === undefined) {
        throw new Error('Cannot link: source node has no exit ID (topology not established)');
    }

    const targetEntry = target.getEntryId();

    // RFC-054: Use flat arguments for zero-allocation
    const result = this.bridge.connect(this.exitId, targetEntry, weight, jitter);
    
    if (result < 0) {
        // BRIDGE_ERR.NOT_FOUND = -1, BRIDGE_ERR.TABLE_FULL = -2
        throw new Error(`Failed to create synapse from ${this.exitId} to ${targetEntry}: error ${result}`);
    }
    
    return this;
}
```

**Effort**: Small (15 min)

**Test**: Add test that fills synapse table, then attempts `linkTo()` and verifies exception thrown.

---

## Priority 2: HIGH (Fix Before v1.0)

### STATE-001: Loop Closure Skipped When entryId Undefined [HIGH]

**Issue**: `setCycle()` creates BARRIER even when `entryId` is undefined, but doesn't create loop synapse. Barrier is orphaned.

**Risk**: Orphaned barrier node blocks playback indefinitely, memory leak.

**Fix Location**: `packages/synaptic/src/SynapticNode.ts:87-119`

**Option A - Defensive (Recommended)**:
```typescript
} else {
    // Insert new barrier
    
    // Guard: Cannot create cycle without content
    if (this.entryId === undefined) {
        throw new Error('Cannot set cycle: node has no content (entryId undefined)');
    }
    
    const sourceId = this.bridge.generateSourceId();
    // ... rest of insertion code
```

**Option B - Deferred Intent** (more complex, defer to future):
Store cycle intent and create barrier when first content is added.

**Effort**: Small (15 min for Option A)

**Test**: Verify `setCycle(480)` on empty node throws error.

---

---

### KERNEL-002: disconnectAsync() Failure Silently Ignored [HIGH]

**Issue**: `disconnectAsync()` at line 74 ignores return value.

**Risk**: Loop synapse persists after barrier is deleted.

**Fix Location**: `packages/synaptic/src/SynapticNode.ts:74`

**Note**: `disconnectAsync()` is fire-and-forget (queues to ring buffer). Cannot synchronously verify success.

**Mitigation Options**:

1. **Document the limitation** (minimal):
```typescript
// NOTE: disconnectAsync is fire-and-forget. If it fails, 
// loop synapse may persist pointing to deleted barrier.
// Caller should check HDR.ERROR_FLAG if precise cleanup required.
this.bridge.disconnectAsync(this.barrierPtr, entryPtr);
```

2. **Add error flag check after batch** (better):
```typescript
// At end of setCycle(0):
const errorFlag = Atomics.load(this.bridge.getSAB(), HDR.ERROR_FLAG);
if (errorFlag !== 0) {
    console.warn(`Cycle removal may be incomplete: error ${errorFlag}`);
}
```

**Effort**: Small (15 min for option 2)

---

### KERNEL-003: patchDirect() Failure Silently Ignored [HIGH]

**Issue**: `patchDirect()` at line 86 ignores return value.

**Risk**: Barrier duration not updated, user expects different cycle length.

**Fix Location**: `packages/synaptic/src/SynapticNode.ts:86`

**Fix**:
```typescript
if (this.barrierId !== undefined) {
    const result = this.bridge.patchDirect(this.barrierId, 'duration', ticks);
    if (result < 0) {
        throw new Error(`Failed to update barrier duration: error ${result}`);
    }
}
```

**Effort**: Small (10 min)

**Test**: Mock `patchDirect` to return error, verify exception thrown.

---

### KERNEL-004: connectAsync() Failure Silently Ignored [HIGH]

**Issue**: `connectAsync()` at line 116 ignores return value (fire-and-forget).

**Risk**: Loop synapse not created, cycle doesn't work.

**Fix Location**: `packages/synaptic/src/SynapticNode.ts:116`

**Note**: Same as KERNEL-002 - async operations cannot be verified synchronously.

**Mitigation**: Document limitation or add telemetry check:
```typescript
this.bridge.connectAsync(ptr, entryPtr, 500, 0);

// Optional: Schedule verification on next tick
// ALLOCATION OK: setCycle() runs on main thread, not audio worklet.
// Closure allocation is acceptable here.
queueMicrotask(() => {
    const errorFlag = Atomics.load(this.bridge.getSAB(), HDR.ERROR_FLAG);
    if (errorFlag !== 0) {
        console.warn(`Loop closure may have failed: error ${errorFlag}`);
    }
});
```

**Effort**: Medium (30 min)

---

### RFC-001: setCycle(0) Doesn't Guarantee Topology Linearity [HIGH]

**Issue**: Per RFC-054 §3.4, `setCycle(0)` should result in "linear (open-ended)" topology, but failures aren't detected.

**Risk**: User believes cycle removed, but topology still loops.

**Fix**: Combine fixes from STATE-002, KERNEL-002, and add verification:

```typescript
setCycle(ticks: number): void {
    this.cycle = ticks;

    if (ticks <= 0) {
        // Remove cycle
        if (this.barrierPtr !== undefined) {
            // 1. Disconnect loop synapse FIRST
            if (this.entryId !== undefined) {
                const entryPtr = this.bridge.getNodePtr(this.entryId);
                if (entryPtr !== undefined) {
                    this.bridge.disconnectAsync(this.barrierPtr, entryPtr);
                }
            }
            
            // 2. THEN delete the barrier node
            this.bridge.deleteAsync(this.barrierPtr);

            // 3. Clear local state
            this.barrierId = undefined;
            this.barrierPtr = undefined;
        }
        return;
    }
    // ... rest unchanged
}
```

**Effort**: Included in STATE-002 fix

---

## Priority 3: MEDIUM (Fix in Next Sprint)

### STATE-003: writeId Fallback May Insert at Wrong Position [MEDIUM]

**Issue**: Line 101 `this.writeId ?? this.exitId` could be undefined if called on empty node.

**Risk**: BARRIER inserted at unexpected position.

**Note**: This is mitigated by STATE-001 fix. If we guard against empty nodes, this becomes unreachable.

**Fix**: No additional fix needed if STATE-001 is implemented.

**Effort**: None (covered by STATE-001)

---

### RFC-002: Loop Closure Conditional on entryId Availability [MEDIUM]

**Issue**: RFC-054 doesn't specify behavior when `entryId` is undefined. Implementation silently skips loop closure.

**Fix**: Add RFC clarification and defensive code (per STATE-001).

**Recommendation**: Update RFC-054 to explicitly state:
> `setCycle(ticks)` where `ticks > 0` MUST throw if `entryId` is undefined. A cycle requires content to loop back to.

**Effort**: Small (10 min documentation)

---

## Priority 4: LOW (Optional Tech Debt)

### STATE-002: Operation Order in setCycle(0) is Non-Idiomatic [LOW]

**Issue**: `deleteAsync` called before `disconnectAsync`. Reads as deleting node before disconnecting synapse.

**Kernel Verification (2026-01-30)**: Reviewed `synapse-allocator.ts:136-160` and `synapse-view.ts:87-102`.

**Finding**: `disconnect()` uses pointer VALUES (integers) for hash lookup:
```typescript
// synapse-view.ts:87-100
public findHeadSlot(sourcePtr: number): number {
    let slot = this.hash(sourcePtr)  // Hashes INTEGER value
    ...
    if (storedSource === sourcePtr) { return slot }  // Compares INTEGER values
}
```

The synapse table stores `SOURCE_PTR` as an integer key. Disconnect finds and tombstones the synapse using the stored integer, regardless of whether the node at that address exists.

**Conclusion**: No functional bug. The order is cosmetic - conventional pattern would disconnect before delete for code clarity.

**Remediation**: Optional style improvement:
```typescript
// Preferred order (clarity, no functional difference):
this.bridge.disconnectAsync(this.barrierPtr, entryPtr);  // 1. Disconnect synapse
this.bridge.deleteAsync(this.barrierPtr);                 // 2. Delete node
```

**Effort**: Optional (5 min if desired)

---

## Summary

| Priority | ID | Title | Effort | Status |
|----------|-----|-------|--------|--------|
| CRITICAL | KERNEL-001 | connect() failure ignored | 15 min | TODO |
| HIGH | STATE-001 | Loop closure skipped on empty node | 15 min | TODO |
| HIGH | KERNEL-002 | disconnectAsync() failure ignored | 15 min | TODO |
| HIGH | KERNEL-003 | patchDirect() failure ignored | 10 min | TODO |
| HIGH | KERNEL-004 | connectAsync() failure ignored | 30 min | TODO |
| HIGH | RFC-001 | setCycle(0) linearity guarantee | 0 min | (covered) |
| MEDIUM | STATE-003 | writeId fallback undefined | 0 min | (covered) |
| MEDIUM | RFC-002 | RFC clarification needed | 10 min | TODO |
| LOW | STATE-002 | Operation order is non-idiomatic | 0 min | OPTIONAL |
| **TOTAL** | | | **~1.5 hours** | |

---

## Recommended Implementation Order

### Phase 1: Critical Fix (15 min)
1. [ ] **KERNEL-001**: Add error checking to `linkTo()`

### Phase 2: State Consistency (15 min)
2. [ ] **STATE-001**: Guard `setCycle()` against empty nodes

### Phase 3: Error Propagation (55 min)
3. [ ] **KERNEL-003**: Add error checking to `patchDirect()` call
4. [ ] **KERNEL-002**: Add error flag check after disconnect
5. [ ] **KERNEL-004**: Add error flag check after loop closure

### Phase 4: Documentation (10 min)
6. [ ] **RFC-002**: Update RFC-054 with empty node behavior

### Phase 5: Optional (Tech Debt)
7. [ ] **STATE-002**: Reorder disconnect/delete for clarity (cosmetic only)

---

## Test Requirements

After remediation, add these tests:

```typescript
describe('SynapticNode Error Handling', () => {
    test('linkTo() throws when synapse table full', () => {
        // Fill synapse table to capacity
        // Attempt linkTo()
        // Expect error thrown
    });

    test('setCycle() throws on empty node', () => {
        const node = new ConcreteNode(bridge);
        expect(() => node.setCycle(480)).toThrow('no content');
    });

    test('setCycle(0) disconnects before deleting', () => {
        // Create cycled node
        // Call setCycle(0)
        // Verify no orphaned synapses
    });

    test('patchDirect failure propagates', () => {
        // Mock patchDirect to return error
        // Verify error thrown
    });
});
```

---

## Async Error Handling Strategy

The fundamental challenge is that `*Async()` methods are fire-and-forget. Long-term options:

1. **Telemetry Polling** (Current recommendation): Check `HDR.ERROR_FLAG` after batches
2. **Callback Pattern**: Bridge invokes callback when command processed
3. **Promise-based API**: `await bridge.connectAsyncWithConfirmation()`
4. **Transactional Semantics**: All-or-nothing command batches

For v1.0, telemetry polling is sufficient. Revisit for v2.0 if reliability requirements increase.

---

**End of Remediation Plan**
