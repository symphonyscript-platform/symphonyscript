# SYNAPTIC LAYER AUDIT REPORT

**Package:** `@symphonyscript/synaptic`  
**Auditor:** Hostile Zero-Trust Auditor  
**Date:** 2026-01-30  
**RFC Cross-Reference:** RFC-054 (Native Phase Locking)

---

## Revision History

| Rev | Date | Changes |
|-----|------|---------|
| 1.0 | 2026-01-30 | Initial audit |
| 1.1 | 2026-01-30 | **Architect Feedback:** Fixed finding count (was 13, now 9 - eliminated double-counting). Downgraded STATE-002 from HIGH to LOW after kernel verification confirmed `disconnect()` uses pointer values for hash lookup, not live node references. |

---

## Executive Summary

| Category | Grade | Critical | High | Medium | Low |
|----------|-------|----------|------|--------|-----|
| State Consistency | B | 0 | 1 | 1 | 1 |
| Kernel Integration | C | 1 | 3 | 0 | 0 |
| Audio Thread Safety | A | 0 | 0 | 0 | 0 |
| PRNG Correctness | A | 0 | 0 | 0 | 0 |
| RFC Compliance | B | 0 | 1 | 1 | 0 |
| **OVERALL** | **B-** | **1** | **5** | **2** | **1** |

**Note on counting:** Each finding is categorized once. Kernel Integration findings (KERNEL-001 through KERNEL-004) represent bridge call issues. Error handling coverage analysis in Section F is diagnostic context, not separate findings.

**Verdict:** The implementation is fundamentally sound but has silent failure modes that could cause state inconsistencies. SynapticCursor achieves zero-allocation compliance. SynapticNode has multiple bridge calls that ignore error codes.

---

## A. State Consistency Audit (SynapticNode)

### A.1 State Transition Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                    SynapticNode State Machine                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   INITIAL STATE:                                                │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ entryId: undefined                                       │  │
│   │ exitId: undefined                                        │  │
│   │ barrierId: undefined                                     │  │
│   │ barrierPtr: undefined                                    │  │
│   │ writeId: undefined                                       │  │
│   │ cycle: Infinity                                          │  │
│   └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼ (concrete impl adds content)        │
│   CONTENT ADDED STATE:                                          │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ entryId: number (first node)                             │  │
│   │ exitId: number (last node)                               │  │
│   │ writeId: number (last content node)                      │  │
│   └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼ setCycle(ticks > 0)                 │
│   CYCLED STATE:                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ barrierId: number (BARRIER sourceId)                     │  │
│   │ barrierPtr: number (BARRIER raw ptr)                     │  │
│   │ cycle: ticks                                             │  │
│   │ INVARIANT: synapse(barrierPtr → entryPtr) exists         │  │
│   └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼ setCycle(ticks <= 0)                │
│   UN-CYCLED STATE:                                              │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ barrierId: undefined                                     │  │
│   │ barrierPtr: undefined                                    │  │
│   │ cycle: ticks (0 or negative)                             │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### A.2 Invariant Verification

| Property | Invariant | Verification | Status |
|----------|-----------|--------------|--------|
| `entryId` | Set on first content addition | Abstract class - concrete impl responsibility | N/A |
| `exitId` | Always tracks chain tail | Abstract class - concrete impl responsibility | N/A |
| `barrierId`/`barrierPtr` | Set together (lines 108-109), cleared together (lines 78-79) | Verified | ✅ PASS |
| `writeId` | Tracks insertion point for BARRIER | Never set in abstract class | ⚠️ SPEC |

### A.3 Findings

---

**[HIGH] [STATE-001]: Loop Closure Skipped When entryId Undefined**

Location: `SynapticNode.ts:113-118`

```typescript
// Connect barrier to entry (loop closure)
if (this.entryId !== undefined) {
    const entryPtr = this.bridge.getNodePtr(this.entryId);
    if (entryPtr !== undefined) {
        this.bridge.connectAsync(ptr, entryPtr, 500, 0);
    }
}
```

**Violation:** If `setCycle()` is called before any content is added (`entryId === undefined`), a BARRIER node is created and stored in `barrierId`/`barrierPtr`, but **no loop synapse is created**. The topology is left in an inconsistent state: a barrier exists but doesn't loop back.

**Impact:** 
- The barrier node will block playback indefinitely (waiting for phase alignment that never resolves)
- Subsequent content additions won't automatically connect to the orphaned barrier
- Memory leak: the barrier node exists but serves no purpose

**Remediation:**
```typescript
// Option A: Throw if no content
if (this.entryId === undefined) {
    throw new Error('Cannot set cycle: no content nodes exist');
}

// Option B: Defer barrier creation (lazy)
// Store cycle intent, create barrier when entryId becomes defined
```

---

**[LOW] [STATE-002]: Operation Order in setCycle(0) is Non-Idiomatic**

Location: `SynapticNode.ts:65-81`

```typescript
if (ticks <= 0) {
    if (this.barrierPtr !== undefined) {
        this.bridge.deleteAsync(this.barrierPtr);  // 1. Delete barrier node

        if (this.entryId !== undefined) {
            const entryPtr = this.bridge.getNodePtr(this.entryId);
            if (entryPtr !== undefined) {
                this.bridge.disconnectAsync(this.barrierPtr, entryPtr);  // 2. Disconnect synapse
            }
        }

        this.barrierId = undefined;
        this.barrierPtr = undefined;
    }
    return;
}
```

**Initial Concern:** Delete before disconnect might cause disconnect to fail on deleted node.

**Kernel Verification:** Reviewed `synapse-allocator.ts` and `synapse-view.ts`:
```typescript
// synapse-view.ts:87-100
public findHeadSlot(sourcePtr: number): number {
    if (sourcePtr === NULL_PTR) return -1
    let slot = this.hash(sourcePtr)  // Hash the INTEGER VALUE
    ...
    if (storedSource === sourcePtr) { return slot }  // Compare INTEGER VALUES
}
```

**Finding:** `disconnect()` uses pointer VALUES (integers) for hash lookup. It does NOT validate node existence. The synapse table stores `SOURCE_PTR` as an integer key. Disconnect will find and tombstone the synapse regardless of whether the node at that address still exists.

**Actual Impact:** None functional. Code style issue only - conventional pattern would disconnect before delete for clarity.

**Remediation:** Optional style improvement. No functional fix required.

---

**[MEDIUM] [STATE-003]: writeId Fallback May Insert at Wrong Position**

Location: `SynapticNode.ts:101`

```typescript
this.writeId ?? this.exitId // Insert after writeId, fallback to exitId
```

**Issue:** If both `writeId` and `exitId` are `undefined`, the expression evaluates to `undefined`, which the kernel may treat as `NULL_PTR` (insert at head). This could cause unexpected behavior if `setCycle()` is called on an empty node.

**Impact:** BARRIER could be inserted at an unexpected position.

**Remediation:** This is partially mitigated by STATE-001. If that's fixed, this becomes unreachable.

---

## B. Kernel Integration Audit

### B.1 Bridge Call Audit Table

| # | Method | Location | Sync/Async | Args Validated | Return Checked | Error Propagated |
|---|--------|----------|------------|----------------|----------------|------------------|
| 1 | `bridge.connect()` | L41 | Sync | Partial (exitId checked) | ❌ NO | ❌ NO |
| 2 | `bridge.deleteAsync()` | L68 | Async | ✅ (barrierPtr checked) | ❌ NO | ❌ NO |
| 3 | `bridge.getNodePtr()` | L72, L114 | Sync | ✅ | ✅ (undefined check) | N/A |
| 4 | `bridge.disconnectAsync()` | L74 | Async | ✅ (entryPtr checked) | ❌ NO | ❌ NO |
| 5 | `bridge.patchDirect()` | L86 | Sync | ✅ (barrierId checked) | ❌ NO | ❌ NO |
| 6 | `bridge.generateSourceId()` | L89 | Sync | N/A | N/A | N/A |
| 7 | `bridge.insertAsync()` | L93-102 | Async | ✅ | ✅ (< 0 throws) | ✅ |
| 8 | `bridge.connectAsync()` | L116 | Async | ✅ (entryPtr checked) | ❌ NO | ❌ NO |

**Summary:** 1 of 6 fallible operations has proper error handling. The rest silently ignore failures.

### B.2 Findings

---

**[CRITICAL] [KERNEL-001]: connect() Failure Silently Ignored**

Location: `SynapticNode.ts:41`

```typescript
this.bridge.connect(this.exitId, targetEntry, weight, jitter);
```

**Violation:** `SiliconBridge.connect()` returns `SynapsePtr` on success or `BRIDGE_ERR.NOT_FOUND` / `BRIDGE_ERR.TABLE_FULL` on failure. This return value is discarded.

**Impact:** 
- If the synapse table is full, `linkTo()` silently fails
- The caller believes the connection succeeded
- The neural topology is broken without any indication
- This is a **data corruption** scenario: user intent (connect A to B) is not reflected in system state

**Remediation:**
```typescript
linkTo(target: SynapticNode, weight?: number, jitter?: number): this {
    if (this.exitId === undefined) {
        throw new Error('Cannot link: source node has no exit ID');
    }

    const targetEntry = target.getEntryId();
    const result = this.bridge.connect(this.exitId, targetEntry, weight, jitter);
    
    if (result < 0) {
        throw new Error(`Failed to create synapse: error code ${result}`);
    }
    
    return this;
}
```

---

**[HIGH] [KERNEL-002]: disconnectAsync() Failure Silently Ignored**

Location: `SynapticNode.ts:74`

```typescript
this.bridge.disconnectAsync(this.barrierPtr, entryPtr);
```

**Violation:** No error handling. If disconnect fails, the loop synapse persists even though the barrier is deleted.

**Impact:** Orphaned synapse entry pointing to deleted node.

---

**[HIGH] [KERNEL-003]: patchDirect() Failure Silently Ignored**

Location: `SynapticNode.ts:86`

```typescript
this.bridge.patchDirect(this.barrierId, 'duration', ticks);
```

**Violation:** `patchDirect()` returns `BRIDGE_ERR.OK` or `BRIDGE_ERR.NOT_FOUND`. Return value discarded.

**Impact:** If the barrier node was deleted externally, the duration update fails silently. User expects cycle length changed but it wasn't.

---

**[HIGH] [KERNEL-004]: connectAsync() Failure Silently Ignored**

Location: `SynapticNode.ts:116`

```typescript
this.bridge.connectAsync(ptr, entryPtr, 500, 0);
```

**Violation:** Async operation with no error handling.

**Impact:** Loop closure may fail silently if synapse table is full.

---

## C. Audio Thread Safety Audit (SynapticCursor)

### C.1 Hot Path Methods

| Method | Lines | Purpose |
|--------|-------|---------|
| `resolveSynapseWithCallback()` | 193-238 | Core synapse resolution |
| `findHeadSlot()` | 262-284 | Hash table lookup |
| `collectCandidates()` | 296-342 | Chain traversal |
| `selectWinner()` | 355-390 | Weighted random selection |
| `nextRandom()` | 411-418 | PRNG |

### C.2 Zero-Allocation Compliance Matrix

| Pattern | Found | Location | Verdict |
|---------|-------|----------|---------|
| Object literals `{}` | ❌ None | - | ✅ PASS |
| Array literals `[]` | ❌ None | - | ✅ PASS |
| `new` keyword (non-constructor) | ❌ None | - | ✅ PASS |
| Arrow functions created in hot paths | ❌ None | Callbacks passed in | ✅ PASS |
| `for...of` loops | ❌ None | Uses `while` | ✅ PASS |
| `for...in` loops | ❌ None | Uses `while` | ✅ PASS |
| `throw` statements | ❌ None | Returns error codes | ✅ PASS |
| `try/catch` blocks | ❌ None | - | ✅ PASS |
| String concatenation | ❌ None | - | ✅ PASS |
| Template literals | ❌ None | - | ✅ PASS |

### C.3 Loop Pattern Verification

All loops use index-based `while` with explicit increment:

```typescript
// Line 364-367 - selectWinner
let i = 0
while (i < candidateCount) {
    totalWeight = totalWeight + this.candWeights[i]
    i = i + 1  // Explicit increment, no allocation
}
```

**Verdict:** ✅ **ZERO-ALLOCATION COMPLIANT**

---

## D. PRNG Correctness Audit

### D.1 Implementation Analysis

```typescript
private nextRandom(): number {
    let x = this.prngState
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.prngState = x >>> 0
    return this.prngState
}
```

### D.2 Verification Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| Shift triplet validity | ✅ PASS | (13, 17, 5) is a maximal-period xorshift32 triplet |
| Unsigned right shift | ✅ PASS | Uses `>>> 17` (not signed `>>`) |
| 32-bit coercion | ✅ PASS | Final `>>> 0` ensures unsigned |
| Zero fixpoint handling (constructor) | ✅ PASS | Line 100: `(prngSeed >>> 0) \|\| 1` |
| Zero fixpoint handling (setSeed) | ✅ PASS | Line 425: `(seed >>> 0) \|\| 1` |

### D.3 Determinism Verification

Given seed `S`, the sequence is fully deterministic:
- `nextRandom()` is pure (depends only on `prngState`)
- No external entropy sources
- Atomic operations on SAB don't affect PRNG

**Verdict:** ✅ **PRNG CORRECT**

---

## E. RFC-054 Specification Analysis

### E.1 Requirement Compliance Matrix

| RFC-054 Requirement | Section | Implementation | Verdict |
|---------------------|---------|----------------|---------|
| `OPCODE.BARRIER = 0x05` | §3.2 | Line 94: `OPCODE.BARRIER` | ✅ PASS |
| BARRIER pitch=0, velocity=0 | §3.2 | Lines 95-96 | ✅ PASS |
| BARRIER duration = cycle length | §3.2 | Line 97: `ticks` | ✅ PASS |
| BARRIER baseTick = 0 | §3.2 | Line 98: `0` | ✅ PASS |
| Track `barrierId`, `barrierPtr`, `writeId` | §3.4 | Lines 20-22 | ✅ PASS |
| Idempotent setCycle (update duration) | §3.4 | Line 86: `patchDirect` | ✅ PASS |
| setCycle(0) removes barrier | §3.4 | Lines 67-80 | ⚠️ PARTIAL |
| Loop synapse: BARRIER → Entry | §3.4 | Line 116 | ⚠️ PARTIAL |
| `connectAsync(ptr, ptr)` for internal wiring | §3.5 | Line 116 | ✅ PASS |

### E.2 Findings

---

**[HIGH] [RFC-001]: setCycle(0) Doesn't Guarantee Topology Linearity**

Location: `SynapticNode.ts:65-81`

**RFC-054 §3.4 states:**
> 4. Result: The topology becomes linear (open-ended).

**Violation:** The implementation queues `deleteAsync` and `disconnectAsync` but:
1. Does not verify they succeeded
2. Does not wait for confirmation
3. Clears local state (`barrierId = undefined`) immediately

If the disconnect fails, the topology is NOT linear - a synapse still points from a deleted barrier to the entry.

---

**[MEDIUM] [RFC-002]: Loop Closure Conditional on entryId Availability**

Location: `SynapticNode.ts:113-118`

**RFC-054 §3.6 states:**
> if (this.entryPtr !== undefined) { this.bridge.connectAsync(ptr, this.entryPtr, 500, 0); }

The RFC example shows the same conditional pattern. However, it doesn't specify what happens if `entryPtr` is undefined - is this an error or acceptable no-op?

**Recommendation:** RFC should clarify whether `setCycle()` on an empty node is:
- An error (throw)
- A deferred intent (set cycle, connect when content added)
- A silent no-op (current behavior minus barrier creation)

---

## F. Error Handling Coverage

### F.1 Failure Point Analysis

| Failure Point | Handler | Recovery | State Consistent? |
|---------------|---------|----------|-------------------|
| `linkTo()` undefined exit | Throws | Caller handles | ✅ Yes |
| `getEntryId()` undefined | Throws | Caller handles | ✅ Yes |
| `getExitId()` undefined | Throws | Caller handles | ✅ Yes |
| `insertAsync()` < 0 | Throws | Caller handles | ✅ Yes |
| `connect()` failure | **SILENT** | None | ❌ No |
| `disconnectAsync()` failure | **SILENT** | None | ❌ No |
| `patchDirect()` failure | **SILENT** | None | ❌ No |
| `connectAsync()` failure | **SILENT** | None | ❌ No |
| `getNodePtr()` undefined | Skips op | None | ⚠️ Partial |

### F.2 Summary

**Error Propagation Rate:** 4 of 9 failure points properly handled (44%)

**Silent Failure Rate:** 5 of 9 failure points silently ignored (56%)

---

## G. Final Verdict

### G.1 Grade: B-

| Aspect | Grade | Rationale |
|--------|-------|-----------|
| Architecture | A | Clean separation, correct abstractions |
| Correctness | C+ | Silent failures undermine guarantees |
| Safety | A | Zero-allocation in audio path |
| RFC Compliance | B | Implementation matches spec, but spec has gaps |
| Error Handling | D | Majority of failures ignored |

### G.2 Critical Defects (Must-Fix)

| ID | Title | Severity | Fix Complexity |
|----|-------|----------|----------------|
| KERNEL-001 | `connect()` failure silently ignored | CRITICAL | Low |

### G.3 High Defects (Should-Fix)

| ID | Title | Severity | Fix Complexity |
|----|-------|----------|----------------|
| STATE-001 | Loop closure skipped when entryId undefined | HIGH | Medium |
| KERNEL-002 | `disconnectAsync()` failure silently ignored | HIGH | Low |
| KERNEL-003 | `patchDirect()` failure silently ignored | HIGH | Low |
| KERNEL-004 | `connectAsync()` failure silently ignored | HIGH | Low |
| RFC-001 | setCycle(0) doesn't guarantee topology linearity | HIGH | Medium |

### G.4 Medium Defects (Nice-to-Fix)

| ID | Title | Severity | Fix Complexity |
|----|-------|----------|----------------|
| STATE-003 | writeId fallback may insert at wrong position | MEDIUM | Low |
| RFC-002 | Loop closure conditional on entryId availability | MEDIUM | Low |

### G.5 Low Defects (Tech Debt)

| ID | Title | Severity | Fix Complexity |
|----|-------|----------|----------------|
| STATE-002 | Operation order in setCycle(0) is non-idiomatic | LOW | Optional |

### G.6 The Hard Problem

**Silent Failure Propagation in Async Commands**

The fundamental challenge is that async bridge operations (`insertAsync`, `deleteAsync`, `connectAsync`, `disconnectAsync`) are fire-and-forget. The calling code immediately updates local state, but the kernel may fail to execute the command (table full, invalid pointer, race condition).

**Options:**
1. **Synchronous verification** - After each async op, poll until confirmed (latency penalty)
2. **Callback on completion** - Bridge invokes callback when worker processes command (complexity)
3. **Transactional semantics** - All-or-nothing command batches (significant refactor)
4. **Telemetry-based detection** - Monitor error flags and node counts (reactive, not preventive)

The current "optimistic" approach is valid for performance but should at least check `HDR.ERROR_FLAG` periodically and provide recovery mechanisms.

---

## Appendix: Files Audited

| File | Lines | Thread Context | Allocation Allowed |
|------|-------|----------------|-------------------|
| `SynapticNode.ts` | 145 | Main Thread | ✅ Yes |
| `SynapticCursor.ts` | 427 | Audio Thread | ❌ No (hot paths) |

---

**End of Audit Report**
