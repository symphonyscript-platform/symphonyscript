# Task 3.3: Fix Atomics.wait — Detect at Construction, Not Hot Path

**RFC:** 004 (Kernel Remediation)  
**Task:** 3.3  
**Severity:** MEDIUM  
**Status:** IMPLEMENTED

---

## Problem

`Atomics.wait()` throws `TypeError` when called from the main thread. The previous implementation called it unconditionally in `_yieldToCPU()`, which would throw on main thread.

```typescript
// BEFORE (problematic)
private _yieldToCPU(): void {
  Atomics.wait(this.sab, HDR.YIELD_SLOT, 0, 1)  // Throws on main thread!
}
```

A naive fix using `try/catch` in `_yieldToCPU()` would **violate zero-allocation** — try/catch allocates exception frames on each call.

---

## Solution

Detect `Atomics.wait` support **once at construction time**, then use a simple boolean check in the hot path:

### 1. Added Property (line 81)

```typescript
// Task 3.3: Detect Atomics.wait support once at construction (not in hot path)
private readonly canAtomicsWait: boolean
```

### 2. Added Detection Helper (lines 133-147)

```typescript
/**
 * Detect if Atomics.wait is supported in this context.
 *
 * Called once at construction time. Workers support Atomics.wait,
 * main thread throws TypeError. This detection allows zero-allocation
 * hot path by avoiding try/catch in _yieldToCPU().
 */
private _detectAtomicsWaitSupport(): boolean {
  try {
    // Use a dummy test with immediate timeout
    // Value -1 ensures "not-equal" return (no actual wait)
    Atomics.wait(this.sab, HDR.YIELD_SLOT, -1, 0)
    return true
  } catch {
    return false
  }
}
```

### 3. Constructor Call (line 130)

```typescript
// Task 3.3: Detect Atomics.wait support ONCE at construction (not in hot path)
this.canAtomicsWait = this._detectAtomicsWaitSupport()
```

### 4. Updated Hot Path (lines 200-212)

```typescript
private _yieldToCPU(): void {
  // Task 3.3: Only call Atomics.wait if supported (detected at construction)
  // Hot path is ZERO-ALLOC: simple boolean check, no try/catch
  if (this.canAtomicsWait) {
    Atomics.wait(this.sab, HDR.YIELD_SLOT, 0, 1)
  }
  // On main thread: no-op — spin continues without yield
  // This is acceptable because main thread mutex acquisition is rare
}
```

---

## Why This Works

| Aspect | Before | After |
|--------|--------|-------|
| try/catch location | Would be in hot path | Constructor only (cold path) |
| Hot path allocation | Would allocate exception frames | Zero — just boolean check |
| Main thread behavior | Would throw | No-op, spin continues |
| Worker behavior | Works | Works (unchanged) |

The boolean check `if (this.canAtomicsWait)` is a single CPU instruction — no allocation.

---

## Files Changed

1. `packages/kernel/src/silicon-synapse.ts`
   - Added `canAtomicsWait` readonly property
   - Added `_detectAtomicsWaitSupport()` method
   - Added detection call in constructor
   - Updated `_yieldToCPU()` to use boolean guard

---

## Test Results

```
Test Suites: 12 passed, 12 total
Tests:       213 passed, 213 total
Time:        0.945s
```

All 213 kernel tests pass.

---

## Main Thread Behavior

When called from main thread:
- `_detectAtomicsWaitSupport()` catches TypeError → returns `false`
- `canAtomicsWait = false`
- `_yieldToCPU()` becomes a no-op
- Mutex spin continues without yield (acceptable for rare main thread use)

---

*End of Task 3.3 Log*
